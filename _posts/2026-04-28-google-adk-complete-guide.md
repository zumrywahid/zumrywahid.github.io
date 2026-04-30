---
layout: post
title: "Google ADK — The Complete Guide to Building AI Agents with the Agent Development Kit"
author: Zumry
categories: [ ai, tutorial ]
tags: [ google adk, ai agents, agent development kit, multi-agent, gemini, python, typescript, tutorial ]
image: assets/images/agent_development_kit.png
featured: true
hidden: true
toc: true
description: "A complete guide to Google's Agent Development Kit (ADK) — what it is, why it exists, how to build agents, multi-agent teams, tools, safety, and deployment."
---

Google released the Agent Development Kit — ADK — and it is not just another AI framework. It is a full production-grade system for building, debugging, and deploying AI agents that actually work in the real world. Open source, multi-language, and designed to scale from a single agent on your laptop to a fleet of coordinated agents on Google Cloud.

If you have been [building agents with CrewAI](/building-ai-agent-team-for-business/) or rolling your own with raw API calls, ADK is worth paying attention to. It solves problems that most frameworks ignore — context management, safety guardrails, multi-agent delegation, and seamless deployment.

Let us break down everything you need to know.

## What is Google ADK

The Agent Development Kit is an open-source framework for building AI agents. Not chatbots. Not simple prompt wrappers. Autonomous agents that can reason, use tools, maintain memory, delegate tasks to other agents, and recover from failures.

ADK supports four languages — **Python**, **TypeScript**, **Go**, and **Java** — with consistent APIs across all of them. You write agents the same way regardless of your stack.

What sets ADK apart from other frameworks:

- **Context as structured code** — ADK does not just concatenate strings. It automatically filters irrelevant events, summarizes older conversation turns, lazy-loads artifacts, and tracks token usage to stay efficient within context windows
- **Built-in safety layer** — callbacks for validating inputs and tool usage before execution, not as an afterthought
- **Model-agnostic** — works with Gemini, Claude, GPT, Gemma, Ollama, vLLM, and anything LiteLLM supports
- **Production deployment built in** — same code runs locally and on Cloud Run, GKE, or the managed Agent Runtime

The official site is [adk.dev](https://adk.dev) and the source lives on GitHub.

## Why Google Built It

Building an AI agent sounds simple until you actually try to run one in production. You quickly hit problems that no LLM API can solve on its own:

**Context window management.** Agents that run for extended sessions blow through context limits. You need intelligent summarization, event filtering, and artifact management. ADK handles this automatically.

**Multi-step reliability.** A real agent makes dozens of decisions in sequence. Each one can fail. You need retry logic, failure recovery, and deterministic workflow control for the parts that should not be left to LLM reasoning.

**Tool orchestration.** Agents need to call APIs, read files, search the web, and interact with external services. Each tool needs authentication, error handling, and validation. ADK provides a structured tool system with built-in and custom tools.

**Safety at scale.** When agents make autonomous decisions, you need guardrails. Input validation before the model sees the prompt. Tool argument checking before execution. ADK provides callback hooks for both.

**Deployment gap.** Most frameworks work great in a Jupyter notebook and fall apart in production. ADK was designed from the start to deploy to Cloud Run, GKE, or managed infrastructure with zero code changes.

Google built ADK because they needed it for their own products. That is usually a good sign for a framework's long-term viability.

## The Three Types of Agents

ADK organizes agents into three categories. Understanding these is the foundation of everything else.

### LLM Agents

The core agent type. Uses a large language model as its reasoning engine to understand input, decide what to do, pick which tools to use, and generate responses. This is what most people think of when they hear "AI agent."

```python
from google.adk import Agent
from google.adk.tools import google_search

agent = Agent(
    name="researcher",
    model="gemini-flash-latest",
    instruction="You help users research topics thoroughly.",
    tools=[google_search],
)
```

LLM agents are non-deterministic — they reason about each request dynamically. Use them for tasks that require understanding natural language, making judgment calls, and adapting to different inputs.

### Workflow Agents

These control the execution flow of other agents in **deterministic, predictable patterns** — without using an LLM for the flow control itself. Three types:

- **SequentialAgent** — runs agents one after another in order
- **ParallelAgent** — runs agents simultaneously
- **LoopAgent** — repeats agents until a condition is met

Use workflow agents when you need guaranteed execution order. SEO research → content writing → social media posting is a perfect sequential workflow. Running a grammar check and a fact check at the same time is a parallel workflow.

### Custom Agents

For when neither LLM nor workflow agents fit. You extend `BaseAgent` directly and implement your own logic. Custom agents are useful for specialized integrations, unique control flows, or hybrid approaches.

The real power comes from **combining all three types**. LLM agents handle the intelligent, language-based tasks. Workflow agents manage the process flow. Custom agents fill in the gaps.

| Aspect | LLM Agent | Workflow Agent | Custom Agent |
|--------|-----------|----------------|--------------|
| **Engine** | Large Language Model | Predefined logic | Your code |
| **Determinism** | Flexible, non-deterministic | Deterministic, predictable | Variable |
| **Best for** | Language tasks, dynamic decisions | Structured processes, orchestration | Tailored requirements |

## Building Your First Agent

Here is a minimal agent in Python. Install ADK first:

```bash
pip install google-adk
```

Create a weather agent with a custom tool:

```python
from google.adk import Agent

def get_weather(city: str) -> dict:
    """Fetches the current weather for a given city.

    Args:
        city: The name of the city to get weather for.

    Returns:
        A dictionary with weather information.
    """
    # In production, call a real weather API
    weather_data = {
        "New York": {"temp": "22°C", "condition": "Sunny"},
        "London": {"temp": "15°C", "condition": "Cloudy"},
        "Tokyo": {"temp": "28°C", "condition": "Humid"},
    }
    return weather_data.get(city, {"temp": "Unknown", "condition": "No data"})

agent = Agent(
    name="weather_agent",
    model="gemini-flash-latest",
    instruction="""You are a helpful weather assistant.
    When users ask about weather, use the get_weather tool
    to fetch current conditions. Provide clear, concise answers.""",
    tools=[get_weather],
)
```

A few things to notice. The tool is a plain Python function — no special decorator, no class to extend. ADK reads the docstring and type hints to understand what the tool does and how to use it. The agent's instruction tells it when and how to use the tool.

### Running the Agent

ADK provides a session system for managing conversations:

```python
from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
import asyncio

# Set up session management
session_service = InMemorySessionService()

async def main():
    session = await session_service.create_session(
        app_name="weather_app",
        user_id="user_1",
        session_id="session_1",
    )

    runner = Runner(
        agent=agent,
        app_name="weather_app",
        session_service=session_service,
    )

    response = await runner.run(input="What's the weather in Tokyo?")
    print(response)

asyncio.run(main())
```

The `Runner` handles the execution loop — sending the user input to the agent, processing tool calls, and returning the final response. The `SessionService` tracks conversation history so the agent remembers context across turns.

## Multi-Agent Teams — Where ADK Shines

Single agents are useful. Teams of specialized agents are transformative. ADK handles multi-agent delegation natively through the `sub_agents` parameter.

Here is a team with three specialized agents and one root agent that routes requests:

```python
from google.adk import Agent

# Specialist agents
greeting_agent = Agent(
    name="greeting_agent",
    model="gemini-flash-latest",
    description="Handles greetings and casual conversation.",
    instruction="You are friendly and welcoming. Handle hellos and casual chat.",
)

weather_agent = Agent(
    name="weather_agent",
    model="gemini-flash-latest",
    description="Provides weather information for any city.",
    instruction="Use the get_weather tool to answer weather questions.",
    tools=[get_weather],
)

research_agent = Agent(
    name="research_agent",
    model="gemini-flash-latest",
    description="Researches topics using web search.",
    instruction="Use Google Search to find accurate, up-to-date information.",
    tools=[google_search],
)

# Root agent — the orchestrator
root_agent = Agent(
    name="coordinator",
    model="gemini-flash-latest",
    instruction="""You are a helpful assistant. Route user requests
    to the most appropriate specialist agent. Use greeting_agent for
    casual conversation, weather_agent for weather queries, and
    research_agent for information requests.""",
    sub_agents=[greeting_agent, weather_agent, research_agent],
)
```

The root agent reads the `description` of each sub-agent and automatically decides who should handle each request. User says "hello" — routes to greeting agent. User asks "what is the weather in London" — routes to weather agent. User asks "what is the latest news about AI" — routes to research agent.

This is the same pattern we explored in the [AI business team post](/building-ai-agent-team-for-business/), but with ADK handling all the delegation plumbing. No manual routing logic needed.

## Tools and Integrations

ADK gives agents capabilities through tools. There are several ways to add them.

### Built-in Tools

Google Search comes out of the box:

```python
from google.adk.tools import google_search

agent = Agent(
    name="researcher",
    model="gemini-flash-latest",
    tools=[google_search],
)
```

### Custom Function Tools

Any Python function with type hints and a docstring becomes a tool:

```python
def search_database(query: str, limit: int = 10) -> list:
    """Searches the product database for matching items.

    Args:
        query: The search term to look for.
        limit: Maximum number of results to return.

    Returns:
        A list of matching products with name, price, and availability.
    """
    # Your database logic here
    return results
```

The docstring is critical. The LLM reads it to understand when to use the tool and what arguments to pass. Vague docstrings produce vague tool usage.

### MCP Tools

ADK supports [Model Context Protocol](/mcp-servers-explained/) tools, so you can connect to any MCP server:

```python
from google.adk.tools.mcp import MCPTool

# Connect to an MCP server for database access
mcp_tool = MCPTool(server_url="http://localhost:3000")
```

### OpenAPI Tools

Generate tools automatically from OpenAPI specifications. Point ADK at your API's OpenAPI spec and it creates tools for every endpoint — no manual wrapping needed.

### Multi-Model Support

ADK is not locked to Gemini. Use any model through LiteLLM:

```python
from google.adk import Agent
from google.adk.models import LiteLlm

# Use Claude
agent = Agent(
    name="analyst",
    model=LiteLlm(model="anthropic/claude-sonnet-4-20250514"),
    instruction="You analyze data and provide insights.",
)

# Use a local Ollama model
agent = Agent(
    name="local_agent",
    model=LiteLlm(model="ollama/llama3"),
    instruction="You run completely locally with no API costs.",
)
```

This means you can mix models within a team — use Gemini Flash for fast routing in the root agent, Claude for complex analysis in a sub-agent, and a local Ollama model for cost-sensitive tasks.

## Session State and Memory

Agents that forget everything between turns are useless for real applications. ADK provides session state so agents can remember context.

### Reading and Writing State in Tools

Tools can access session state through the `ToolContext` parameter:

```python
from google.adk.tools import ToolContext

def get_weather(city: str, tool_context: ToolContext = None) -> dict:
    """Fetches weather for a city, respecting user's unit preference."""
    weather = fetch_weather_api(city)

    # Read user preference from session state
    unit = tool_context.state.get("temp_unit", "celsius")
    if unit == "fahrenheit":
        weather["temp"] = celsius_to_fahrenheit(weather["temp"])

    # Save last searched city to state
    tool_context.state["last_city"] = city

    return weather
```

### Auto-Saving Agent Output

Use `output_key` to automatically save an agent's final response to session state:

```python
agent = Agent(
    name="weather_agent",
    model="gemini-flash-latest",
    instruction="Provide weather information.",
    tools=[get_weather],
    output_key="last_weather_report",  # Auto-saved to session state
)
```

After the agent runs, `session.state["last_weather_report"]` contains its response. Other agents in the team can read this — enabling data flow between agents without explicit piping.

## Safety and Guardrails

This is where ADK separates itself from most frameworks. Safety is not an add-on. It is built into the agent lifecycle with two callback hooks.

### Input Guardrails — before_model_callback

Intercepts the user's input before the LLM sees it. Use this for content filtering, injection detection, or policy enforcement:

```python
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

def safety_check(callback_context: CallbackContext,
                 llm_request: types.GenerateContentConfig) -> None:
    """Block requests that contain prohibited content."""
    user_input = llm_request.contents[-1].parts[0].text

    blocked_terms = ["hack", "exploit", "bypass security"]
    for term in blocked_terms:
        if term.lower() in user_input.lower():
            # Return a response instead of letting it reach the model
            return types.GenerateContentResponse(
                text="I cannot assist with that request."
            )

    return None  # Allow the request to proceed

agent = Agent(
    name="safe_agent",
    model="gemini-flash-latest",
    before_model_callback=safety_check,
)
```

### Tool Guardrails — before_tool_callback

Validates tool arguments before execution. Prevents the agent from making unauthorized API calls or accessing restricted data:

```python
def validate_tool_args(tool_name: str, args: dict) -> bool:
    """Prevent the agent from querying restricted databases."""
    if tool_name == "search_database":
        restricted_tables = ["users", "payments", "credentials"]
        if args.get("table") in restricted_tables:
            return False  # Block this tool call
    return True  # Allow execution

agent = Agent(
    name="restricted_agent",
    model="gemini-flash-latest",
    before_tool_callback=validate_tool_args,
)
```

This two-layer approach — validate input before the model, validate tool usage before execution — gives you fine-grained control over what the agent can do. In production, this is not optional.

## Deployment Options

ADK supports four deployment paths, from fully managed to fully custom.

### Agent Runtime (Agent Platform)

Google's fully managed solution. Auto-scaling, monitoring, and infrastructure handled for you. Best for teams that want zero ops overhead.

### Cloud Run

Serverless containers. You package your agent as a Docker container and deploy it. Auto-scales to zero when idle, scales up under load. Most practical option for small teams.

### Google Kubernetes Engine (GKE)

Full Kubernetes control. Use this when you need custom model hosting (like running Ollama alongside your agents), complex networking, or multi-region deployment.

### Self-Hosted Containers

Package your agent in Docker and run it anywhere — your own servers, AWS, Azure, or a VPS. No Google Cloud dependency required.

The key selling point: **your code does not change between environments**. The same agent that runs on your laptop with `Runner` deploys to Cloud Run or GKE without modification.

## What Can You Build With ADK

ADK is general-purpose, but here are the use cases where it excels:

**Customer support agents** — Multi-agent teams where a router agent triages incoming requests and delegates to specialized agents for billing, technical support, and account management. Session state tracks the customer's history across the conversation.

**Research assistants** — Agents with web search, document reading, and summarization tools that can independently research a topic and produce structured reports.

**Business automation** — The same [SEO, content, and marketing agents](/ai-automation-for-small-business/) we discussed, but built on a framework that handles deployment, scaling, and safety out of the box.

**Retail and e-commerce** — Product recommendation agents, inventory checkers, and order tracking agents working as a team. ADK's sample repository includes a reference retail agent.

**Travel planning** — Multi-step agents that search flights, hotels, and activities, then coordinate bookings. Another reference implementation in the ADK samples.

**Internal developer tools** — Agents that review pull requests, generate documentation, run tests, and report results. The tool system makes it easy to integrate with GitHub, Jira, and CI/CD pipelines.

## ADK vs Other Frameworks

How does ADK compare to the alternatives?

| Feature | Google ADK | CrewAI | LangGraph | AutoGPT |
|---------|-----------|--------|-----------|---------|
| **Languages** | Python, TypeScript, Go, Java | Python | Python, TypeScript | Python |
| **Multi-agent** | Native delegation with routing | Role-based crews | Graph-based orchestration | Single autonomous agent |
| **Model support** | Any (via LiteLLM) | Any (via LiteLLM) | Any | OpenAI-focused |
| **Safety** | Built-in callbacks | Manual | Manual | Minimal |
| **Deployment** | Cloud Run, GKE, Agent Runtime | Self-managed | Self-managed | Self-managed |
| **Context management** | Automatic summarization and filtering | Basic | Manual | Basic |
| **Production readiness** | High — Google-backed | Medium | Medium | Low |
| **Learning curve** | Moderate | Low | High | Low |

**Use ADK when:** you need production deployment, multi-language support, safety guardrails, or Google Cloud integration.

**Use CrewAI when:** you want the simplest possible multi-agent setup in Python and deployment is not a concern yet.

**Use LangGraph when:** you need complex branching workflows with conditional logic that goes beyond sequential or parallel patterns.

## Getting Started

Here is the fastest path from zero to running agent:

1. Install ADK: `pip install google-adk`
2. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com) — free tier gives you 1,000 requests per day
3. Build a single agent with one tool
4. Test it locally with the built-in web interface
5. Add a second agent and wire up delegation
6. Deploy to Cloud Run when you are ready for production

The official documentation at [adk.dev](https://adk.dev) includes full tutorials for multi-tool agents, agent teams with delegation, streaming agents, and sample applications for retail and travel.

ADK is still evolving — Python 2.0 Beta introduced workflows and agent teams, and TypeScript 1.0 just went production-ready. If you are building agents that need to go beyond prototypes and into production, this framework is worth your time.

Start with one agent. Add tools. Add teammates. Deploy. That is the path.
