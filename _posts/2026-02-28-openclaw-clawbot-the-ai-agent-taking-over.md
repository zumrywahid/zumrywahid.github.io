---
layout: post
title: "OpenClaw (ClawBot) — The AI Agent That Took Over the Internet in 10 Weeks"
author: Zumry
categories: [ ai, developer tools ]
tags: [ openclaw, clawbot, ai agent, mcp, ai assistant, open source, peter steinberger ]
image: assets/images/openclaw.png
featured: true
description: "A deep dive into OpenClaw (formerly ClawBot) — the open-source AI agent with 145K GitHub stars, WhatsApp integration, full computer access, and serious security concerns. What it does, how it works, and whether you should use it."
---

If you have been anywhere near tech Twitter in the last two months, you have seen the lobster. ClawBot — now called OpenClaw after a trademark dispute with Anthropic — went from a weekend side project to 145,000 GitHub stars in ten weeks. It has been called the most exciting open-source project of 2026 and also "the biggest insider threat of the year." Both descriptions are accurate.

I have been testing it for the past few weeks alongside my usual stack of [Claude Code, Cursor, and Copilot](/claude-code-vs-cursor-vs-copilot/). Here is what OpenClaw actually is, how it works, what it gets right, and why you should be very careful with it.

## What Is OpenClaw?

OpenClaw is a free, open-source AI agent that turns your messaging apps into a control interface for your computer. You send it a message on WhatsApp, Telegram, Discord, Slack, or any of 15+ supported platforms, and it executes tasks on your machine — running terminal commands, writing files, browsing the web, managing your calendar, controlling smart home devices, and more.

Think of it as an AI assistant that lives in your group chats but has root access to your computer.

It was created by Peter Steinberger, the Austrian developer behind PSPDFKit, as a weekend project in November 2025. By February 2026, he had joined OpenAI and handed the project to an open-source foundation. In between, the project exploded.

## The Name Drama

The naming history is worth mentioning because it tells you something about how fast this space is moving.

The project started as **Clawdbot** — a lobster-themed pun on Anthropic's Claude. Anthropic's lawyers were not amused. They filed trademark complaints in January 2026, and Steinberger renamed it to **Moltbot** (molting is what lobsters do — still on theme). Three days later, it became **OpenClaw**. The lobster mascot stayed.

The whole saga played out publicly on X, which only fueled the hype.

## How It Works

The architecture is a gateway hub that sits between your messaging platforms and AI models. Here is the flow:

```
┌──────────────────────┐
│  Messaging Platforms  │
│  WhatsApp / Telegram  │
│  Discord / Slack / …  │
└──────────┬───────────┘
           │ WebSocket
┌──────────▼───────────┐
│    OpenClaw Gateway   │
│    (Node.js / TS)     │
├──────────────────────┤
│  AI Model Backend     │
│  Claude / GPT / Ollama│
├──────────────────────┤
│  System Actions       │
│  Shell / Files / Web  │
│  Calendar / Camera    │
└──────────────────────┘
```

A persistent WebSocket server runs on port 18789 and routes messages between your chat platforms, the AI model, and your system. Configuration lives in `~/.clawbot/clawbot.json`. Everything runs locally on your hardware — the AI model is the only component that optionally calls an external API.

You can use Claude, GPT-4, or run fully offline with local models through Ollama. The Ollama option means zero cost and zero data leaving your machine, though you need at least 8GB of RAM.

Installation is straightforward:

```bash
npm install -g clawbot@latest
clawbot init
```

The `init` wizard walks you through connecting your messaging platform and choosing an AI backend. On Mac there is also a `.dmg` installer. The whole setup takes under 30 minutes.

## What Makes It Different

I have built and used [AI agents](/building-your-first-ai-agent/) extensively. What sets OpenClaw apart is not the AI capabilities — it is the interface choice.

Most AI agents live in a terminal or an IDE. OpenClaw lives in WhatsApp. That sounds like a gimmick until you realize it means you can control your development machine from your phone while sitting on the couch. I have deployed code, restarted Docker containers, and checked server logs from WhatsApp messages. The barrier to interaction is incredibly low.

**Persistent memory** is the other standout feature. Unlike session-based tools, OpenClaw remembers conversations from weeks ago. Tell it your preferred code style once, and it applies it to every future task. Mention your project structure in a Monday conversation, and it still knows it on Friday. This makes it feel less like a tool and more like an actual assistant.

**The skills marketplace (ClawHub)** has over 5,700 community-built skills — essentially plugins that extend what OpenClaw can do. Security monitoring, SEC filing watchers, ML engineering helpers, ServiceNow integrations. Skills follow the AgentSkills open standard, and building your own is relatively simple.

**Proactive actions** let OpenClaw initiate conversations with you. Morning briefings, deadline reminders, server alerts. You are not just asking it questions — it is watching and notifying.

## OpenClaw vs Claude Code

This is the comparison people keep asking about. They solve fundamentally different problems.

[Claude Code](/claude-code-vs-cursor-vs-copilot/) is a purpose-built coding agent. It lives in your terminal, understands your codebase deeply, runs tests, fixes failures, and iterates. It operates in a sandboxed environment with granular permissions. It is designed for software engineering.

OpenClaw is a general-purpose life assistant that happens to also be able to write code. It connects to your messaging apps, has broad system access, and can manage your calendar, email, and smart home alongside your code.

| Feature | Claude Code | OpenClaw |
|---|---|---|
| **Primary use** | Software engineering | General-purpose assistant |
| **Interface** | Terminal | Messaging apps |
| **Codebase awareness** | Deep (reads full project) | Surface-level |
| **System access** | Sandboxed, permissioned | Full (shell, files, browser) |
| **Test execution** | Yes (runs and fixes) | Yes (runs commands) |
| **Non-coding tasks** | No | Calendar, email, smart home |
| **MCP support** | Yes | Via skills |
| **Security model** | Explicit permissions | Trust-based |
| **Offline mode** | No | Yes (via Ollama) |

For pure coding work, Claude Code is significantly better. The codebase awareness, agentic loop, and [MCP integrations](/mcp-servers-explained/) make it a specialized tool that understands software engineering contexts deeply.

For everything else — managing your digital life from a single chat interface — OpenClaw occupies a space no other tool does.

I use both. Claude Code for development work. OpenClaw for the "can you check if my server is still running" messages I send from my phone at midnight.

## The Security Problem

Now for the part that matters most. OpenClaw has serious security concerns, and I am not being alarmist — this is well documented.

**Cisco's AI security team** tested a third-party OpenClaw skill and found it performed data exfiltration and prompt injection without the user knowing. The skill looked legitimate, passed basic review, and silently sent data to an external server.

**Palo Alto Networks** called it "the potential biggest insider threat of 2026." When an AI agent has shell access, file system access, and browser access, one successful prompt injection gives an attacker control of your machine.

**Snyk** put it bluntly: OpenClaw is "one prompt injection away from disaster."

**Hundreds of malicious skills** have been found in the ClawHub marketplace. These skills passed initial automated checks but contained obfuscated code that exfiltrated configuration files, API keys, and chat histories.

**A Meta AI safety employee** reported that OpenClaw deleted a significant portion of her email inbox without authorization during what should have been a simple email management task.

The core issue is the security model. OpenClaw gives the AI agent broad system access and trusts it to behave. There is no sandboxing, no granular permissions, no confirmation step before destructive actions. Compare this to Claude Code, which asks for explicit permission before file modifications and runs in a controlled environment.

The project currently has no bug bounty program and no dedicated security team.

## Should You Use It?

Here is my honest take.

**Yes, if** you understand the risks and take precautions:
- Run it on a dedicated machine or VM, not your primary development laptop
- Never install third-party skills without reading the source code
- Use Ollama for the AI backend so no data leaves your network
- Do not give it access to email or accounts with sensitive data
- Treat it as an experiment, not a production tool

**No, if** you work with sensitive data, client projects, or anything where a security breach would be catastrophic. The attack surface is too large and the security model is too permissive.

**For coding specifically**, stick with [Claude Code](/claude-code-vs-cursor-vs-copilot/). It is built for the job, has proper sandboxing, and does not require you to give an AI agent unrestricted access to your entire system.

## The Moltbook Phenomenon

One more thing worth mentioning. The OpenClaw ecosystem spawned **Moltbook** — a social platform where AI agents communicate with each other. Taglined "the front page of the agent internet," it went viral with 1.6 million registered agents by February 2026.

Agents post updates, share information, and interact autonomously. It is fascinating and slightly terrifying. The implications for [AI agent development](/building-your-first-ai-agent/) are significant — we are moving toward a world where agents do not just serve humans but coordinate with each other.

## What This Means for AI Engineering

OpenClaw matters regardless of whether you use it personally. It proved three things:

1. **The messaging interface works.** People want to interact with AI through apps they already use, not through specialized terminals or IDEs. This will influence how we build AI products going forward.

2. **Open-source AI agents can scale fast.** 145K GitHub stars in ten weeks shows there is massive demand for autonomous AI agents. As an [AI Product Engineer](/what-does-ai-product-engineer-do/), this tells me agent-based products are the next wave.

3. **Security is the unsolved problem.** Giving AI agents system access creates an attack surface we do not have good tools to manage yet. Whoever solves agent security — proper sandboxing, permission models, and skill verification — will build something enormously valuable.

The lobster took over the internet. Whether it stays or gets cooked depends entirely on whether the community can solve the security problem before something goes seriously wrong.
