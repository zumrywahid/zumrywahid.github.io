---
layout: post
title: "Adding Cards to Apple Wallet — A Developer's Guide to In-App Provisioning"
author: Zumry
categories: [ mobile development, tutorial ]
tags: [ ios, swift, apple wallet, apple pay, passkit, in-app provisioning, fintech, payments ]
image: assets/images/adding_cards_to_apple_wallet.png
featured: true
description: "Complete developer guide to Apple Wallet in-app provisioning. Learn how to add cards to Apple Wallet with PassKit, PKAddPaymentPassViewController, and your card processor."
---

If you have ever tapped **Add to Apple Wallet** inside a banking app and watched your card slide into Wallet without ever leaving the app, you have used **In-App Provisioning**. It feels like magic. Under the hood, it is a careful choreography between your app, Apple, and your card issuer's backend.

I have shipped this flow in production for a fintech app, and the number of moving pieces surprised me the first time. Most of the documentation out there is either too shallow ("just call `PKAddPaymentPassViewController`") or too deep in processor-specific noise. This post is the middle ground — enough detail to actually get it working, without pretending the edge cases do not exist.

## Why In-App Provisioning?

Before in-app provisioning existed, adding a card to Apple Wallet meant opening the Wallet app, typing in card details, and going through a verification flow outside your app. That is a lot of friction for a user who just wants to pay.

In-app provisioning lets you:

- Present an **Add to Apple Wallet** button directly inside your app.
- Push card data securely to Apple without the user typing anything.
- Keep the user in your experience the entire time.

The payoff: higher activation rates, fewer support tickets, and a much cleaner UX. In the fintech project I worked on, card activation jumped from around 40% to over 75% after we shipped in-app provisioning. That is a massive win for a flow that takes the user three taps.

## The Big Picture

Here is the flow at 30,000 feet:

1. User taps **Add to Apple Wallet** inside your app.
2. Your app asks `PKPassLibrary` whether the card can be added.
3. iOS launches Apple's provisioning UI (`PKAddPaymentPassViewController`).
4. Apple generates a **certificate signing request** (CSR) — nonce, nonce signature, and a certificate chain.
5. Your app forwards that payload to your backend.
6. Your backend calls the card network or issuer processor to get back an **encrypted payment pass** (activation data, ephemeral public key, encrypted pass data).
7. Your app hands that payload back to Apple.
8. Apple decrypts it on the Secure Element and provisions the card.

The critical insight: **your app never sees the real card data**. Everything sensitive flows through encrypted blobs that only Apple's Secure Element can open. This is also why you cannot test any of this in the simulator — there is no Secure Element.

## Prerequisites

Before you write a single line of code, you will need:

| Requirement | Notes |
|-------------|-------|
| Apple Developer account with Wallet entitlement | `com.apple.developer.payment-pass-provisioning` — not enabled by default, requires Apple review |
| Card issuer processor with push provisioning | Marqeta, Thales, Galileo, i2c, Stripe Issuing, etc. |
| Certificates and signing keys | Provided by your processor |
| Physical device | Simulator cannot provision real payment passes |
| Sandbox test card | From your processor — production card testing requires extra paperwork |

**Heads up:** Getting the entitlement approved is often the slowest part of this entire project. I have seen it take anywhere from two weeks to two months. Start the paperwork early — before you write any code.

## Step 1: Check If the Card Can Be Added

Before showing the button, ask iOS if adding is even possible. A device might already have the card provisioned, or the card might be provisioned on a paired Apple Watch but not the phone.

```swift
import PassKit

func canAddCardToWallet(primaryAccountIdentifier: String) -> Bool {
    guard PKAddPaymentPassViewController.canAddPaymentPass() else {
        return false
    }

    let library = PKPassLibrary()

    // Already on this device?
    let alreadyOnPhone = library.passes(of: .payment)
        .contains { ($0 as? PKPaymentPass)?.primaryAccountIdentifier == primaryAccountIdentifier }

    // Already on a paired watch?
    let remotePasses = library.remoteSecureElementPasses
    let alreadyOnWatch = remotePasses
        .contains { $0.primaryAccountIdentifier == primaryAccountIdentifier }

    return !alreadyOnPhone || !alreadyOnWatch
}
```

The `primaryAccountIdentifier` is a stable identifier for the card that your backend issues. You will use it to disambiguate "already on iPhone" from "already on Apple Watch" — they are separate provisioning events.

## Step 2: Present the Add-to-Wallet Sheet

Once you know the user can add the card, hand off to `PKAddPaymentPassViewController`. You configure a request with metadata about the card, and iOS takes it from there.

```swift
func presentAddToWallet(
    cardHolderName: String,
    last4: String,
    from presenter: UIViewController
) {
    let config = PKAddPaymentPassRequestConfiguration(encryptionScheme: .ECC_V2)
    config?.cardholderName = cardHolderName
    config?.primaryAccountSuffix = last4
    config?.localizedDescription = "Debit Card"
    config?.paymentNetwork = .visa  // or .masterCard, .amex, etc.
    config?.style = .payment

    guard let configuration = config,
          let controller = PKAddPaymentPassViewController(
              requestConfiguration: configuration,
              delegate: self
          )
    else { return }

    presenter.present(controller, animated: true)
}
```

Note the `encryptionScheme`: almost everyone uses `.ECC_V2` today. Your processor will tell you which one they support, but if they are still on `.RSA_V2`, that is a red flag.

## Step 3: Respond to Apple's Certificate Request

After the user confirms, iOS calls your delegate with a set of certificates, a nonce, and a nonce signature. These together form the CSR that your backend will send to the card processor.

```swift
extension AddToWalletCoordinator: PKAddPaymentPassViewControllerDelegate {

    func addPaymentPassViewController(
        _ controller: PKAddPaymentPassViewController,
        generateRequestWithCertificateChain certificates: [Data],
        nonce: Data,
        nonceSignature: Data,
        completionHandler handler: @escaping (PKAddPaymentPassRequest) -> Void
    ) {
        Task {
            do {
                // Send the CSR off to your backend.
                let encryptedPass = try await backend.provisionPass(
                    certificates: certificates,
                    nonce: nonce,
                    nonceSignature: nonceSignature
                )

                // Populate Apple's request object with what the processor returned.
                let request = PKAddPaymentPassRequest()
                request.encryptedPassData  = encryptedPass.encryptedPassData
                request.activationData     = encryptedPass.activationData
                request.ephemeralPublicKey = encryptedPass.ephemeralPublicKey

                handler(request)
            } catch {
                // Calling the handler with an empty request tells iOS to fail.
                handler(PKAddPaymentPassRequest())
            }
        }
    }

    func addPaymentPassViewController(
        _ controller: PKAddPaymentPassViewController,
        didFinishAdding pass: PKPaymentPass?,
        error: Error?
    ) {
        controller.dismiss(animated: true) {
            if let error = error {
                print("Provisioning failed: \(error)")
            } else {
                print("Card added successfully.")
            }
        }
    }
}
```

Two things to watch here:

1. **Never block the main thread.** The delegate method may arrive on the main queue — dispatch real work off of it. I use a `Task` block as shown above.
2. **Always call `handler`,** even on failure. If you do not, the iOS sheet will hang forever and the user will have to force-quit your app. I hit this bug in production — do not repeat my mistake.

## Step 4: Your Backend Does the Real Work

This is the part that varies wildly depending on your processor. The shape is always the same:

```
App → Your Backend → Processor / Network API
```

Your backend takes the certificates, nonce, and nonce signature, wraps them in whatever envelope your processor expects (usually JSON, sometimes with extra signing), and gets back three values:

- `encryptedPassData`
- `activationData`
- `ephemeralPublicKey`

Those get returned to the app and handed straight to Apple. **Your server should not log or persist these values** — they are one-time use and tied to that specific device's Secure Element. If your compliance team ever audits the pipeline, they will check for this.

A simplified contract between your app and backend:

```swift
struct ProvisioningRequest: Encodable {
    let cardId: String
    let certificates: [String]     // base64
    let nonce: String              // base64
    let nonceSignature: String     // base64
}

struct EncryptedPass: Decodable {
    let encryptedPassData: Data
    let activationData: Data
    let ephemeralPublicKey: Data
}
```

Keep the contract minimal. The less your app knows about the processor, the easier it is to swap processors later. I have seen teams bake Marqeta-specific field names directly into their iOS code — do not do that.

## Common Pitfalls

A few things I wish someone had told me sooner:

- **The entitlement is tied to your bundle ID.** If you split your app into extensions or a new target, each one that needs provisioning needs the entitlement in its own `.entitlements` file.
- **`canAddPaymentPass()` can return `false` for boring reasons** — MDM restrictions, a device without a Secure Element (older iPads), or a region where Apple Pay is not available. Handle this gracefully; do not show a dead button.
- **Apple Watch is a separate device.** A card provisioned on iPhone is not automatically on the Watch. You may need to run the flow twice, once per device, and `PKPassLibrary.remoteSecureElementPasses` is how you detect the Watch state.
- **Test on real hardware from day one.** The simulator will lie to you about what is possible.
- **Localize the sheet strings.** `localizedDescription` shows up in Wallet — make sure it is translated.
- **The sandbox flow is not identical to production.** Most processors have subtle differences between sandbox and live mode. Budget time for a second round of testing when you flip the switch.
- **Watch out for the 90-second delegate timeout.** If your backend call takes too long, iOS will cancel the provisioning. Keep the roundtrip under 30 seconds to be safe.

## Recommended Build Order

If you are just getting started, build in this order:

1. **Get the entitlement approved.** Start now. Really.
2. **Stub out the delegate methods** and confirm the sheet appears with fake data.
3. **Wire up one real call** to your processor's sandbox.
4. **Test on a real device** with a real test card.
5. **Handle the edge cases** — Watch, already-provisioned, region checks, backend timeouts.
6. **Add analytics** at every step of the flow. You will want to know exactly where users drop off.

## Wrapping Up

The API surface for in-app provisioning is small. Apple has been careful to hide the cryptography behind a handful of delegate methods, and the rest is integration work with your card processor.

The hardest part is not the code — it is the paperwork, the processor integration, and the edge cases. Once it is working, it feels like magic to users, which is exactly the point.

If you are building iOS apps and want to ship faster, check out my guide on [setting up Xcode Cloud](/xcode-cloud-setup-guide/) to automate your builds and TestFlight distribution. Pairing Xcode Cloud with a solid provisioning flow means you can push a card feature from branch to tester in under 20 minutes.
