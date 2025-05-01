---
layout: post
title:  "SwiftUI Coordinator pattern - (Navigation management)"
author: Zumry
categories: [ mobile development, tutorial, swiftUI ]
image: assets/images/12.png
featured: true
hidden: true
---

![Project structure](/assets/images/coordinator_pattern.gif)

When it comes to SwiftUI UI navigation, even though there is a way to navigate by default, it is not suitable for mid to large scale projects due to it's complexity. Coordinator pattern is the helper here. Specially if you are a new develper, you must know that following a best practice will not hurt you in the long run.

in SwiftUI, coordinators works like delegators. Just like delegators in UIKit, They will respond for the event actions takes place somewhere in the code. When you press the login or signup button, the coordinator (delegate) will act accordingly and take you to the destination.

Why you should implement Coordinator pattern? 

- Seperate the navigation logic. 
- Clean coding.
- Reusable and testable code.



## Let me create a simple SwftUI app to test the coordinator.

### Create a simple SwiftUI project

 - Coordinator.swift - Created Coordinator class
 - AppRootView.swift - Which will be the root view and initiate the coordinator class
 - Pages.swift - Contains the enums of the UI pages of the app. This is helpful for cordinator class to decide the destination.

 And i created some UIs, such as DashboardView, LoginView, SignupView and the ForgetPasswordView

![Project structure](/assets/images/coordinator_pattern_img1.jpg)


Lets see how the Coordinator class is implemented,

You should remember to make this class an `ObservableObject`. this is part of Combine framework and it will share the state among the UIs. 

I added Sheet, FullScreen for experimental purpose. So we can fully test a basic app. 

```
import Foundation
import SwiftUI

class Coordinator: ObservableObject {
    
    @Published var path: NavigationPath = NavigationPath()
    @Published var sheet: Sheet?
    @Published var fullScreenCover: FullScreenCover?
    
    func push(_ page: AppPages) {
        path.append(page)
    }
    
    func pop() {
        path.removeLast()
    }
    
    func popToRoot() {
        path.removeLast(path.count)
    }
    
    func presentSheet(_ sheet: Sheet) {
        self.sheet = sheet
    }
    
    func dismissSheet() {
        self.sheet = nil
    }
    
    func presentFullScreenCover(_ cover: FullScreenCover) {
        self.fullScreenCover = cover
    }
    
    func dismissFullScreenCover() {
        self.fullScreenCover = nil
    }
    
    
    @ViewBuilder
    func build(page: AppPages) -> some View {
        switch page {
        case .login:
            LoginView()
        case .dashboard:
            DashboardView()
        }
    }
    
    @ViewBuilder
    func buildSheet(sheet: Sheet) -> some View {
        switch sheet {
            case .forgetPassword: ForgetPasswordView()
        }
    }
    
    @ViewBuilder
    func buildFullScreenCover(cover: FullScreenCover) -> some View {
        switch cover {
        case .signup: SignupView()
        }
    }
    
}

```

The class is simple to understand i guess. The `path` value will maintain the state of the `NavigationPath`. This will be passed to navigation stack later. 

The `build` function will create the UI and pass it to navigator based on the enum value. 



Let's see the Enum we created,


```
import Foundation

enum AppPages: Hashable {
    case dashboard
    case login
}

enum Sheet: String, Hashable, Identifiable {
    var id: String {
        self.rawValue
    }
    case forgetPassword
}

enum FullScreenCover: String, Hashable, Identifiable {
    var id: String {
        self.rawValue
    }
    case signup
}
```

You can add as many values here. The logic is seperated based on the type whether it is fullscreen or bottom sheet or just a page. 


I hope this is clear now. Lets move onto the RootView class. This is the bridge where it connects the coordinator with app. 

```
import SwiftUI

struct AppRootView: View {
    //The coordinator object will be shared with the pages via environment object. 
    @StateObject private var coordinator = Coordinator()
    
    var body: some View {
        NavigationStack(path: $coordinator.path) {
            coordinator.build(page: .login)
                .navigationDestination(for: AppPages.self) {page in
                    coordinator.build(page: page)
                }
                .sheet(item: $coordinator.sheet) { sheet in
                    coordinator.buildSheet(sheet: sheet)
                }
                .fullScreenCover(item: $coordinator.fullScreenCover) {cover in
                    coordinator.buildFullScreenCover(cover: cover)
                }
            
        }
        .environmentObject(coordinator)
    }
}

```
You neeed to understand the logic here. `NavigationStack` class want `NavigationPath` object. Coordinator will provide it. Note that `$` mark is used. It means other objects also edit the object. I don't want to make this post bigger by explaining swift features. but it is crucial to understand the underlying mechanism of the language.


When you call the `coordinator.push(.dashboard)`  the `NavigationPath` stack will add the dashboard view in the top. and the navigation stack will react to the change. 

The UI pages are very simple. I don't want to take your time to implement the colorful UI here. I just added a label and a button in each pages. 


[You can check the full sourcecode here.](https://github.com/zumrywahid/swiftui_coordinator_sample.git)

Let me know if you anything in the comment. 

Thank you!