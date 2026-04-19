---
layout: post
title: "How to Build Your AI Business Team — A Developer's Guide to Multi-Agent Automation"
author: Zumry
categories: [ ai, tutorial ]
tags: [ ai agents, crewai, python, automation, multi-agent, tutorial, small business ]
image: assets/images/ai_agent_multiple_agents.png
featured: true
hidden: true
toc: true
description: "A hands-on guide to building a multi-agent AI system with CrewAI. Full working code for SEO, content, and social media agents that run on autopilot."
---

In [Part 1](/ai-automation-for-small-business/) I covered the six AI agent roles that can replace a full business team — SEO, content, social media, ads, and code review. That post was about *what* agents can do. This one is about *how* to build them.

By the end of this post, you will have a working multi-agent system that researches keywords, writes content, and generates social media posts — all chained together and running on a daily schedule. Real code, not theory.

## Prerequisites

You need Python 3.11 or higher, a Claude or OpenAI API key, and a Serper API key for web search (free tier available at [serper.dev](https://serper.dev)).

```bash
pip install crewai crewai-tools
```

Set your environment variables:

```bash
export OPENAI_API_KEY="your-openai-key"
export SERPER_API_KEY="your-serper-key"
```

CrewAI works with OpenAI, Claude, Ollama, and other LLM providers. I am using OpenAI here for simplicity, but you can swap in any model.

## Agents vs Scripts — Why This is Different

Before we build anything, let us be clear about what makes an agent different from a regular API call wrapped in a Python script.

A script runs a fixed sequence of steps. An agent is given a role, a goal, and tools — then it figures out *how* to achieve the goal on its own. It can decide which tools to use, in what order, and it can iterate on its own output if the result is not good enough.

The key properties of an agent:

- **Role and backstory** — defines its expertise and how it approaches problems
- **Goal** — what it is trying to achieve, not the steps to get there
- **Tools** — external capabilities it can use (web search, file writing, APIs)
- **Memory** — it remembers context from previous tasks in the same run
- **Delegation** — it can pass subtasks to other agents

This is why agents are powerful for business automation. You describe the outcome, not the process.

## Building Your First Agent

Let us start simple. One agent, one task — an SEO researcher that finds keyword opportunities.

```python
import os
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool

# Initialize the search tool
search_tool = SerperDevTool()

# Define the SEO Research Agent
seo_agent = Agent(
    role="SEO Research Specialist",
    goal="Find high-opportunity keywords and analyze competitor strategies",
    backstory="""You are an experienced SEO analyst who specializes in
    keyword research and competitor gap analysis. You focus on finding
    keywords with decent search volume but low competition — the sweet
    spot for small businesses trying to rank organically.""",
    tools=[search_tool],
    verbose=True,
    memory=True,
    max_iter=15
)

# Define a task for the agent
keyword_research_task = Task(
    description="""Research the keyword landscape for a small SaaS business
    that sells project management tools. Find 10 high-opportunity keywords
    that have moderate search volume but low competition. For each keyword,
    provide the estimated monthly search volume, competition level, and a
    suggested content angle.""",
    expected_output="""A structured list of 10 keywords with:
    - Keyword phrase
    - Estimated monthly search volume
    - Competition level (low/medium/high)
    - Suggested content angle for a blog post""",
    agent=seo_agent
)

# Build and run the crew
crew = Crew(
    agents=[seo_agent],
    tasks=[keyword_research_task],
    process=Process.sequential,
    verbose=True
)

result = crew.kickoff()
print(result)
```

Save this as `seo_agent.py` and run it:

```bash
python seo_agent.py
```

You will see the agent think through its approach, use the search tool multiple times, analyze results, and produce a structured keyword report. This is not a template being filled in — the agent is actively reasoning about what to search for and how to evaluate the results.

## Building a Multi-Agent Crew

One agent is useful. Multiple agents working together is where it gets interesting. Let us build a three-agent crew: SEO researcher, content writer, and social media manager.

The key concept here is **task context**. When you pass a previous task as context to the next task, the second agent gets access to everything the first agent produced. This is how agents chain together.

```python
import os
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool, FileWriterTool

search_tool = SerperDevTool()
file_writer = FileWriterTool()

# --- Agent Definitions ---

seo_agent = Agent(
    role="SEO Research Specialist",
    goal="Find high-opportunity keywords and create content briefs",
    backstory="""You are an SEO expert who identifies keyword gaps and
    creates actionable content briefs. You focus on long-tail keywords
    that small businesses can realistically rank for.""",
    tools=[search_tool],
    verbose=True,
    memory=True
)

content_agent = Agent(
    role="Content Writer",
    goal="Write engaging, SEO-optimized blog posts based on research briefs",
    backstory="""You are a technical content writer who turns research
    briefs into clear, actionable blog posts. You write for developers
    and technical founders. Your style is direct, no fluff, and packed
    with practical advice. You naturally incorporate target keywords
    without making the content feel forced.""",
    tools=[file_writer],
    verbose=True,
    memory=True
)

social_agent = Agent(
    role="Social Media Manager",
    goal="Create platform-specific social media content from blog posts",
    backstory="""You are a social media strategist who repurposes blog
    content into engaging posts for Twitter/X, LinkedIn, and Instagram.
    You understand the unique format and audience of each platform.
    You write hooks that stop the scroll.""",
    tools=[file_writer],
    verbose=True,
    memory=True
)

# --- Task Definitions ---

seo_task = Task(
    description="""Research keywords for a small business that sells
    invoicing software for freelancers. Find the top 3 keyword
    opportunities and create a content brief for the best one.
    Include: target keyword, secondary keywords, suggested title,
    outline with H2 headings, and target word count.""",
    expected_output="""A detailed content brief with target keyword,
    secondary keywords, title, H2 outline, and word count target.""",
    agent=seo_agent
)

content_task = Task(
    description="""Using the content brief provided, write a complete
    blog post. Follow the outline structure, naturally incorporate
    the target and secondary keywords, and write in a direct,
    practical tone. Include a compelling introduction and a clear
    call-to-action at the end.""",
    expected_output="""A complete blog post in markdown format,
    ready to publish. Save it to output/blog_post.md""",
    agent=content_agent,
    context=[seo_task]  # Gets output from SEO task
)

social_task = Task(
    description="""Based on the blog post, create social media content:
    1. Three tweet/X posts with different hooks (under 280 chars each)
    2. One LinkedIn post (conversational, 150-200 words)
    3. Two Instagram caption options (with relevant hashtags)
    Save all content to output/social_posts.md""",
    expected_output="""Social media content for Twitter/X, LinkedIn,
    and Instagram, saved to output/social_posts.md""",
    agent=social_agent,
    context=[content_task]  # Gets output from content task
)

# --- Build and Run the Crew ---

crew = Crew(
    agents=[seo_agent, content_agent, social_agent],
    tasks=[seo_task, content_task, social_task],
    process=Process.sequential,
    verbose=True
)

result = crew.kickoff()
print(result)
```

Notice how each task flows into the next using the `context` parameter. The SEO agent researches → its output feeds the content agent → the blog post feeds the social media agent. Three agents, one pipeline, zero manual handoffs.

## Adding Custom Tools

The built-in tools cover web search, file operations, and document processing. But real business automation needs custom tools — your CMS API, your analytics dashboard, your ad platform.

Here is how to build a custom tool. This example creates a simple keyword difficulty checker:

```python
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type
import requests

class KeywordInput(BaseModel):
    """Input for keyword difficulty tool."""
    keyword: str = Field(..., description="The keyword to check difficulty for")

class KeywordDifficultyTool(BaseTool):
    name: str = "keyword_difficulty_checker"
    description: str = "Checks the ranking difficulty of a keyword and returns a score from 0-100"
    args_schema: Type[BaseModel] = KeywordInput

    def _run(self, keyword: str) -> str:
        # Replace this with your actual SEO API call
        # Example using a hypothetical API
        response = requests.get(
            "https://api.your-seo-tool.com/difficulty",
            params={"keyword": keyword},
            headers={"Authorization": f"Bearer {os.environ['SEO_API_KEY']}"}
        )
        data = response.json()
        return f"Keyword: {keyword}, Difficulty: {data['score']}/100, Volume: {data['volume']}/mo"
```

For simpler tools, use the decorator syntax:

```python
from crewai import tool

@tool("WordPress Publisher")
def publish_to_wordpress(title: str, content: str, status: str = "draft") -> str:
    """Publishes a blog post to WordPress via REST API."""
    response = requests.post(
        "https://your-site.com/wp-json/wp/v2/posts",
        json={"title": title, "content": content, "status": status},
        headers={"Authorization": f"Bearer {os.environ['WP_API_TOKEN']}"}
    )
    if response.status_code == 201:
        return f"Post published: {response.json()['link']}"
    return f"Error: {response.status_code}"
```

Then attach these tools to your agents:

```python
content_agent = Agent(
    role="Content Writer",
    goal="Write and publish SEO-optimized blog posts",
    tools=[file_writer, publish_to_wordpress],
    # ...
)
```

This is where it gets powerful. You can build tools for anything — posting to social media APIs, creating Google Ads campaigns, updating your CRM, sending Slack notifications. The agent decides when and how to use them.

## Running It Daily — Scheduling and Automation

A crew that runs once is a script. A crew that runs every morning at 7 AM is automation.

### Option 1: Cron Job (Simplest)

Save your crew as `daily_content_crew.py` and add a cron job:

```bash
# Edit crontab
crontab -e

# Run every day at 7 AM
0 7 * * * cd /path/to/your/project && /usr/bin/python3 daily_content_crew.py >> /var/log/crew.log 2>&1
```

### Option 2: Python Scheduler

For more control, use `schedule` for a lightweight daemon:

```python
import schedule
import time
from daily_content_crew import run_crew

def job():
    print("Running daily content crew...")
    result = run_crew()
    # Send yourself a summary via email or Slack
    notify_slack(f"Daily crew completed: {result.raw[:500]}")

# Run every day at 7 AM
schedule.every().day.at("07:00").do(job)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### Option 3: n8n (Visual Workflow)

If you prefer a visual approach, [n8n](https://n8n.io) lets you build the same pipeline with a drag-and-drop interface. You can trigger workflows on a schedule, chain AI nodes together, and connect to hundreds of services without writing integration code. It is self-hostable and has a free tier.

This is a solid choice if you want to mix AI agents with non-AI automation steps — like sending the crew's output to Google Sheets, triggering an email campaign, or updating a project board.

## Alternatives Worth Knowing

CrewAI is not the only option. Here is when to consider something else:

| Framework | Best For | Trade-off |
|-----------|----------|-----------|
| **CrewAI** | Multi-agent teams with defined roles | Opinionated structure, great for business workflows |
| **LangGraph** | Complex agent workflows with branching logic | More flexible but steeper learning curve |
| **Claude API + Python** | Simple single-agent tasks | Lightweight, no framework overhead |
| **AutoGPT** | Fully autonomous long-running agents | Less predictable, harder to control |
| **n8n AI Nodes** | Visual workflow automation | Less code, but limited agent customization |

If you only need one agent doing one thing, skip the framework and use the Claude or OpenAI API directly. If you need multiple agents collaborating with defined roles and task dependencies, CrewAI is the sweet spot.

## Tips from Running This Daily

After running multi-agent crews in production, here is what I have learned:

**Set spending limits.** Every LLM call costs money. Set `max_iter` on your agents to prevent runaway loops. Monitor your API usage weekly.

**Log everything.** Set `verbose=True` during development. In production, pipe output to log files. When an agent produces bad output, the logs tell you exactly where its reasoning went wrong.

**Review before publishing.** Never let agents publish directly to production without a review step — at least in the beginning. Use `status: "draft"` for blog posts, schedule social posts for review, and set ads to paused. Once you trust the output quality, you can loosen the leash.

**Start narrow.** Do not build a six-agent crew on day one. Start with one agent, get comfortable with the output quality, then add the next one. Each agent you add is a new variable to tune.

**Use context wisely.** The `context` parameter is how agents share information. Make sure your `expected_output` fields are specific — vague outputs produce vague inputs for the next agent.

## What is Next

You now have the building blocks to automate real business operations with AI agents. A crew that researches, writes, and promotes — running every day while you focus on building your product.

In [Part 1](/ai-automation-for-small-business/) we covered the landscape of what is possible. In this post we built the foundation. In the next posts in this series, I will deep-dive into specific agent setups — starting with a production-ready SEO agent with real API integrations and performance tracking.

The best time to start automating is before you need to hire. The tools are here. The cost is low. Build your AI team today.
