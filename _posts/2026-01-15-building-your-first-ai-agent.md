---
layout: post
title: "Building Your First AI Agent — From Prompt to Production"
author: Zumry
categories: [ ai, tutorial ]
tags: [ ai agents, function calling, llm, python, orchestration ]
image: assets/images/ai_agents.png
featured: true
description: "Learn how to build an AI agent from scratch. Covers agent architecture, tool use, function calling, orchestration patterns, and production deployment tips with Python examples."
---

AI agents are everywhere right now, and most of the tutorials out there make them look either trivially simple or impossibly complex. Having built several agents in production — from customer support bots to code review pipelines — I want to share what actually works.

## What Is an AI Agent vs a Chatbot?

A chatbot takes your input, generates a response, and that is it. One turn, one response, done. An AI agent is fundamentally different. It can:

- **Take actions** — call APIs, query databases, write files, send emails
- **Use tools** — invoke external functions to interact with the real world
- **Maintain state** — remember what happened across multiple steps
- **Make decisions** — choose which tool to use based on the current situation, then loop back for more

The simplest way I think about it: a chatbot is a calculator, an agent is an employee. The employee can look things up, ask follow-up questions, use different tools, and decide when the job is done.

## Core Architecture — The Agent Loop

Every agent follows the same fundamental loop, regardless of framework:

```
┌──────────────────────────────────┐
│          OBSERVE                 │
│  (Receive input or tool result)  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│           THINK                  │
│  (LLM decides what to do next)  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│            ACT                   │
│  (Call a tool or return answer)  │
└──────────────┬───────────────────┘
               │
               ▼
       ┌───────────────┐
       │  Done?  No ───┤──► Back to OBSERVE
       └───────┬───────┘
               │ Yes
               ▼
         Return result
```

The agent receives input, the LLM reasons about what to do, it takes an action (usually a tool call), observes the result, and repeats until it decides the task is complete. This loop is deceptively simple, but getting it right in production is where the real work begins.

## Key Components

Every agent has four essential parts:

**LLM (The Brain)** — The language model that does the reasoning. Claude, GPT-4, Gemini, or a local model via Ollama. This is where the "thinking" happens. Pick a model that supports tool use natively — it makes everything simpler.

**Tools (The Hands)** — Functions the agent can call. These are what turn a chatbot into an agent. A tool can be anything: a database query, an API call, a file operation, a web search. The LLM decides which tool to call and with what arguments. If you want to understand how tool integration is being standardized across AI products, check out my [deep dive into MCP servers](/mcp-servers-explained/).

**Memory (The Context)** — The conversation history, previous tool results, and any persisted state. Short-term memory is the current conversation. Long-term memory can be a vector database or simple key-value store. In my experience, most agents only need short-term memory to be useful.

**Orchestration (The Control Flow)** — The logic that manages the agent loop, handles tool execution, enforces guardrails, and decides when to stop. This is your application code — the glue that holds everything together.

## Tool Use — Function Calling in Practice

Tool use is the core capability that separates agents from chatbots. Here is how it works: you define functions with clear names, descriptions, and parameter schemas. The LLM sees these definitions and decides when and how to call them.

Consider an agent that handles internal support tickets. It needs three tools:

```python
tools = [
    {
        "name": "search_knowledge_base",
        "description": "Search the internal knowledge base for relevant articles",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "send_email",
        "description": "Send an email to a team member",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"}
            },
            "required": ["to", "subject", "body"]
        }
    },
    {
        "name": "create_ticket",
        "description": "Create a support ticket in the ticketing system",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]}
            },
            "required": ["title", "description", "priority"]
        }
    }
]
```

When a user says "The billing page is broken and the finance team needs to know," the agent will reason through the steps: search the knowledge base for known billing issues, create a high-priority ticket, and email the finance team — all without explicit instructions for each step.

The key insight here is that **good tool descriptions matter more than good prompts**. I have seen agents fail not because the LLM was bad, but because the tool descriptions were vague or misleading.

## Orchestration Patterns

There are three patterns I use in production, and knowing when to pick each one saves a lot of pain:

**Single Agent** — One LLM with a set of tools. Best for focused tasks like answering questions from a knowledge base, triaging tickets, or summarizing documents. Start here. Most use cases do not need more.

**Multi-Agent (Handoff)** — Multiple specialized agents that can transfer control to each other. Use this when you have clearly distinct domains. For example, a support system where one agent handles billing questions and another handles technical issues. Each agent has its own tools and system prompt.

**Supervisor Pattern** — A "manager" agent that delegates tasks to worker agents and aggregates results. Best for complex workflows like research tasks, where one agent searches the web, another analyzes data, and the supervisor combines the findings. This is the most complex pattern and I only reach for it when the other two are not enough.

My rule of thumb: **start with a single agent and only add complexity when you hit a wall**. I have seen too many teams jump to multi-agent systems on day one and drown in orchestration complexity.

## Building a Simple Agent in Python

Here is a minimal working agent using the Anthropic SDK with tool use. This agent can look up user information and check order status:

```python
import anthropic
import json

client = anthropic.Anthropic()

tools = [
    {
        "name": "get_user",
        "description": "Look up a user by email address",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string"}
            },
            "required": ["email"]
        }
    },
    {
        "name": "get_order_status",
        "description": "Check the status of an order by order ID",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"}
            },
            "required": ["order_id"]
        }
    }
]

def execute_tool(name, input):
    if name == "get_user":
        return {"name": "Alice", "email": input["email"], "plan": "pro"}
    if name == "get_order_status":
        return {"order_id": input["order_id"], "status": "shipped", "eta": "Jan 20"}

def run_agent(user_message):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            tools=tools,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            return response.content[0].text

        # Process tool calls
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })
        messages.append({"role": "user", "content": tool_results})

print(run_agent("What is the status of order ORD-1234 for alice@example.com?"))
```

That is a fully functional agent in about 40 lines. The `while True` loop is the agent loop — it keeps going until the LLM decides it has enough information to respond without calling another tool. In production, you would add a max iteration limit, error handling, and logging, but the core pattern stays the same.

## Production Considerations

Building the agent is the easy part. Running it reliably is where most teams struggle. Here is what I have learned:

**Error handling and retries** — Tools fail. APIs time out. Wrap every tool execution in try/catch with exponential backoff. Return clear error messages to the LLM so it can reason about what went wrong and try a different approach.

**Guardrails** — Set a maximum number of loop iterations (I use 10-15 for most agents). Validate tool inputs before execution. Block dangerous actions like deleting production data. Use a separate, fast model to classify outputs before returning them to users.

**Cost management** — Every loop iteration costs tokens. Long conversations with many tool calls add up fast. Track token usage per request. Set budget limits. Use caching for repeated tool calls. Consider using a smaller model for simple routing decisions and a larger model for complex reasoning.

**Observability** — Log every step: the LLM's reasoning, tool calls, tool results, and final output. Use structured logging. You will need this to debug why the agent sent the wrong email or created a duplicate ticket at 3 AM. Tools like LangSmith, Braintrust, or a simple JSON log file work well here.

**Latency** — Each tool call adds a network round trip plus LLM inference time. A 3-step agent might take 10-15 seconds. Set user expectations accordingly, use streaming for the final response, and consider parallel tool execution where the SDK supports it.

## Real-World Use Cases

These are the use cases where I have seen agents deliver real value in production:

**Customer support** — Agents that can look up account information, check order status, process refunds, and escalate to humans when needed. This is the most mature use case and where most teams should start.

**Code review** — Agents that pull PR diffs, check against style guides, run static analysis, and post review comments. I use this in my own workflow and it catches real issues that linters miss.

**Data analysis** — Agents that can write and execute SQL queries, generate charts, and summarize findings. Give the agent access to your database schema and a safe read-only connection, and it becomes a powerful analytics tool.

**DevOps automation** — Agents that monitor alerts, diagnose issues by querying logs and metrics, and execute runbooks. This is where the supervisor pattern shines — one agent triages the alert, another investigates, and a third executes the fix.

The pattern I keep seeing is that agents work best when the task is **well-defined but requires multiple steps**, and when the cost of a mistake is low enough to tolerate occasional errors. If you are curious about what it looks like to work with agents and AI systems professionally, I wrote about the [AI Product Engineer role](/what-does-ai-product-engineer-do/) and how it ties into building production agents. Start small, measure everything, and expand the agent's capabilities only when you have the observability to trust it.

The tools and SDKs are mature enough now that the hardest part is no longer the technology — it is defining the right scope for your agent and building the guardrails to keep it on track.
