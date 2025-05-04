---
layout: post
title:  "Singleton pattern in iOS apps"
author: Zumry
categories: [ mobile development, tutorial ]
image: assets/images/13.png
featured: true
hidden: true
---

<!-- ![Project structure](/assets/images/coordinator_pattern.gif) -->


## Singleton Pattern in iOS: A Simple Guide for New Developers

In software development world design patterns are crucial. Without it your code would be mess and your team will be in great trouble. In this post, I would like to write about one of the most commonly used (and debated) Singleton Pattern. I’ll break it down in the simplest way possible—what it is, when to use it, and how to implement it in Swift.

## What is a Singleton?

A Singleton is a design pattern that ensures only one instance of a class exists throughout your app’s lifecycle. It provides a global point of access to that instance.


## Why Use a Singleton?

- A single, shared resource (e.g., a network manager, a database handler).
- A central configuration object (e.g., app settings, user session).
- To avoid repeatedly creating and destroying the same object.


## Let me create an example

```swift
class NetworkManager {

    static let shared = NetworkManager()
    private init() {}

    func fetchData(completion: @escaping (Result<Data, Error>) -> Void) {

    }

}
```

You can see the constructor is private. so no one caninitialize by calling constructors. only things we can do is like this,

`let shared = NetworkManager.shared()`

The `shared` object is now a global object. you can use it anywhere.

## When you should use the singleton class ?

- App level confugrations such as Appsettings or UserSession
- Shared resources like the above example or Logging or analytics

Make sure you are not using singeleton for state management. 


Also there is another important thing to consider is multiple access at same time. This is going to be issue if you don't things ahead. Lets say if you many thread access a property same time, the value will be random or wrong. To prevent that, we can use something like this,

```swift
class ThreadSafeSingleton {
    static let shared = ThreadSafeSingleton()
    private init() {}
    private let queue = DispatchQueue(label: "singleton.class", attributes: .concurrent)
    private var _data: [String] = []
    
    var data: [String] {
        get {
            return queue.sync { _data }
        }
        set {
            queue.async(flags: .barrier) { self._data = newValue }
        }
    }
}
```

There `queue` will prevent you from accessing same time. It will put you in queue and let you access after the first party is finished his task.



Okay, Make sure to use the singeleton carefully in your iOS apps too!!


Thank you!

