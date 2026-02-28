---
layout: post
title: "Vibe Coding — I Built a Full App Without Writing a Single Line Manually"
author: Zumry
categories: [ ai coding, productivity ]
tags: [ vibe coding, ai coding, claude code, ai workflow, prototyping ]
image: assets/images/vibe_coding.png
featured: false
description: "I built a full-stack app using only AI prompts — no manual coding. Here's what vibe coding looks like in practice, what works, what breaks, and tips for doing it effectively."
---

A few weeks ago, I decided to run an experiment. I would build a full-stack task management app — backend, frontend, database, Docker setup, the whole thing — without manually writing a single line of code. Every character would come from AI. I just had to describe what I wanted and steer the ship.

Sounds absurd? Welcome to vibe coding.

## What is Vibe Coding?

The term was coined by Andrej Karpathy, the former head of AI at Tesla and co-founder of OpenAI. The idea is simple but radical: you describe what you want in plain English, and AI writes all the code. You don't type functions. You don't wrestle with syntax. You just *vibe* with the AI.

Karpathy described it as "fully giving in to the vibes, embracing exponentials, and forgetting that the code even exists." You become less of a programmer and more of a creative director — guiding, reviewing, and nudging the AI toward what you actually want.

It sounds like a gimmick. I wanted to see if it actually works for real software.

## The Experiment

Here is what I set out to build: a task management tool with a Go backend API, a Next.js frontend, PostgreSQL for storage, and Docker to tie it all together. Nothing groundbreaking, but enough moving parts to stress-test the workflow.

My tools: Claude Code as my primary AI coding assistant — which I compared against Cursor and Copilot in my [AI coding tools breakdown](/claude-code-vs-cursor-vs-copilot/). No IDE shortcuts, no copy-pasting from Stack Overflow. Just me and the terminal, having a conversation.

The rules were strict. I could review code, ask for changes, and reject outputs — but I could not manually edit any file. Every change had to come through a prompt.

## The Workflow

The process followed a natural rhythm. Start broad, then zoom in.

**Step 1: High-level architecture.** I began with the big picture.

```
Create a task management API in Go using the standard library
for HTTP and PostgreSQL for storage. I need CRUD endpoints for
tasks (create, read, update, delete) and a simple user model.
Use clean architecture with separate handlers, services, and
repository layers.
```

Claude Code scaffolded the entire project structure — `cmd/`, `internal/handlers/`, `internal/services/`, `internal/repository/`, config files, the works. The initial skeleton was surprisingly well-organized.

**Step 2: Flesh out the features.** Once the structure existed, I got specific.

```
Add a GET /tasks endpoint that supports filtering by status
(pending, in_progress, done) and sorting by created_at.
Include pagination with limit and offset query parameters.
Return proper JSON responses with total count in headers.
```

**Step 3: Build the frontend.** Same approach, different stack.

```
Create a Next.js app with a dashboard that shows all tasks in
a kanban-style board. Use Tailwind CSS for styling. The board
should have three columns: To Do, In Progress, and Done. Users
should be able to drag tasks between columns.
```

**Step 4: Wire it all together.**

```
Create a docker-compose.yml that runs the Go API on port 8080,
the Next.js frontend on port 3000, and PostgreSQL on 5432.
Include a volume for database persistence and environment
variables for database connection strings.
```

Each step built on the previous one. I would review the output, ask clarifying questions, request changes, and move on. The whole process felt like pair programming with someone who types infinitely fast.

## What Worked Surprisingly Well

I will be honest — some of this was shockingly good.

**Boilerplate and scaffolding.** This is where AI absolutely shines. Setting up project structures, config files, Dockerfiles, and CI templates used to take me an hour or two. AI did it in seconds, and the output was clean.

**CRUD operations.** Create, read, update, delete — the bread and butter of most apps. The generated handlers, service methods, and SQL queries were solid. Proper error handling, appropriate HTTP status codes, and reasonable validation.

**API route design.** The RESTful endpoints followed conventions correctly. Proper use of HTTP methods, consistent response formats, meaningful error messages. It felt like the AI had internalized every API design guide ever written.

**Database schema design.** I described my data model in plain English and got back well-structured PostgreSQL migrations with appropriate indexes, foreign keys, and constraints. Even the naming conventions were consistent.

**Docker setup.** The docker-compose file worked on the first try. Multi-stage builds for the Go binary, proper networking between services, health checks — all there without me asking.

**Basic UI components.** Buttons, forms, cards, modals — Tailwind CSS components came out looking decent. Not award-winning, but functional and clean.

## Where It Broke Down

Now for the honest part. Vibe coding is not magic, and it hit walls — hard ones.

**Complex business logic.** When I needed tasks to automatically escalate priority based on approaching deadlines and assignment rules, the AI produced code that *looked* right but had subtle logical errors. It would miss edge cases like tasks with no deadline or users in multiple groups. This required multiple rounds of back-and-forth to get right.

**State management bugs.** The frontend had a fun issue where dragging a task to a new column would update the UI optimistically but fail to sync with the backend on race conditions. Debugging this through prompts alone was painful. I had to describe the exact reproduction steps and error states multiple times.

**CSS pixel-perfection.** Getting the kanban board to look exactly right across screen sizes was an exercise in frustration. The AI would fix one breakpoint and break another. Responsive design through prompts feels like giving directions to someone who cannot see the screen — because, well, they cannot.

**Authentication flows.** Adding JWT auth with refresh tokens, proper middleware, and secure cookie handling required significant iteration. The first few attempts had real security issues — tokens stored in localStorage, missing CSRF protection, overly permissive CORS settings. I caught these during review, but a less experienced developer might not have.

**Error handling edge cases.** The happy path was always solid. But what happens when the database connection drops mid-transaction? What about malformed JSON in request bodies? What about concurrent updates to the same task? Each edge case required a specific prompt, and the AI rarely anticipated them proactively.

## Tips for Effective Vibe Coding

After this experiment, here is what I have learned about making it work.

**Be ridiculously specific.** "Build me a login page" gives mediocre results. "Build a login page with email and password fields, client-side validation that checks email format and minimum 8-character passwords, a loading spinner on submit, and error messages displayed below each field" gives you something usable.

**Provide context upfront.** I use a `CLAUDE.md` file in every project that describes the architecture, conventions, and tech stack. This gives the AI a baseline understanding of what you are building and how, so you spend less time correcting course.

**Iterate in small steps.** Do not ask for an entire feature in one prompt. Break it down. Scaffold first, then add logic, then handle errors, then write tests. Each step gives you a chance to review and redirect.

**Always review generated code.** This is non-negotiable. AI-generated code can look perfect and still have subtle bugs, security issues, or performance problems. Read every line. If you do not understand something, ask the AI to explain it.

**Use plan mode first.** Before generating code, ask the AI to outline its approach. "How would you structure the authentication middleware?" gives you a chance to correct the architecture before hundreds of lines get written.

**Keep a mental model.** Even though you are not writing code, you need to understand what the code does. Vibe coding without comprehension is just generating technical debt faster.

## Is Vibe Coding the Future?

Here is my honest take after building a full app this way.

For **prototyping and MVPs**, vibe coding is incredible. I went from zero to a working full-stack app in a fraction of the time it would normally take. I later used a similar AI-driven workflow to build [DocuMind, a full document intelligence app](/building-documind-ai-document-intelligence/) with Go and Flutter. If you need to validate an idea quickly or build an internal tool, this approach is genuinely powerful.

For **production systems** that handle real users and real data, vibe coding alone is not enough. The code needs human review, testing, and hardening that pure prompting struggles with. You can vibe your way to a prototype, but you need engineering discipline to ship it.

The sweet spot is using vibe coding as a **force multiplier**. You still need to think like an engineer — designing systems, catching edge cases, making architectural decisions. But the mechanical act of translating those decisions into code? AI handles that faster than you ever could.

## The 80/20 Rule

Here is the number that stuck with me after this experiment: AI got me to 80% of a working app in about 20% of the time it would have taken me manually. That is genuinely impressive.

But that last 20% — the edge cases, the polish, the security hardening, the performance tuning — still took real engineering skill and significant time. And that last 20% is often the difference between a demo and a product.

Vibe coding does not replace developers. It replaces the boring parts of development. And honestly? I am completely fine with that. I would rather spend my time on architecture decisions and tricky business logic than writing another CRUD endpoint from scratch.

If you have not tried it yet, pick a side project and give it a shot. Just promise me you will actually read the code it generates.
