---
layout: post
title:  "SwiftUI Coordinator pattern - (Navigation management)"
author: Zumry
categories: [ mobile development, tutorial, swiftUI ]
image: assets/images/12.png
featured: true
hidden: true
---

When it comes to SwiftUI UI navigation, even though there is a way to navigate by default, it is not suitable for mid to large scale projects due to it's complexity. Coordinator pattern is the helper here. Specially if you are a new develper, you must know that following a best practice will not hurt you in the long run.

in SwiftUI, coordinators works like delegators. Just like delegators in UIKit, They will respond for the event actions takes place somewhere in the code. When you press the login or signup button, the coordinator (delegate) will act accordingly and take you to the destination.

Why you should implement Coordinator pattern? 

- Seperate the navigation logic. 
- Clean coding.
- Reusable and testable code.



## Let me create a simple SwftUI app to apply the logic.

### Create a simple SwiftUI project 




""

The mind-warping film opened with a hospital patient Simon Cable (Ryan Phillippe) awakening in a <span class="spoiler"> hospital with little knowledge (amnesia perhaps?) of what had happened, and why he was there, etc. He was told by attending Dr. Jeremy Newman (Stephen Rea) that it was July 29, 2002 (Simon thought it was the year 2000 - he was confused - he heard a doctor say 20:00 hours!) and that he had died for two minutes from cardiac arrest following the near-fatal accident -- but he had been revived ("You're as good as new").</span> Dr. Newman: "Simon, this is the 29th of July. The year is 2002. And your wife, whose name is Anna, is waiting outside." 

(The doctor left off four crucial additional words, revealed in the film's ending.) (Spoiler: Simon had died and was not resuscitated!).

A major clue to everything that truly happened was the scene that played next under the credits - hospital staff failed to bring a patient back to life with a defibrillator after a car accident. Chest compressions failed and there was no pulse. A second major clue was provided by hospital orderly Travis (Stephen Graham): <span class="spoiler">Everybody dies. No mystery there. But why and how everyone dies. Now, there's a mystery worth solving. Probably the biggest mystery there is.</span>

#### So how do we do spoilers?

```html
<span class="spoiler">My hidden paragraph here.</span>
```
