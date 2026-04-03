---
layout: post
title: "How to Self-Host OpenClaw on a VPS — Complete Setup Guide"
author: Zumry
categories: [ ai, developer tools, tutorial ]
tags: [ openclaw, self-hosted, vps, docker, ollama, ai agent, linux, nginx ]
image: assets/images/self_host_openclaw_vps.png
featured: true
description: "Step-by-step guide to self-hosting OpenClaw on a VPS with Docker, Ollama, Nginx reverse proxy, and SSL. Run your own AI agent on a $5/month server."
---

I wrote about [OpenClaw taking over the internet](/openclaw-clawbot-the-ai-agent-taking-over/) back in February. Since then, it has crossed 340K GitHub stars and the self-hosting community has figured out the best ways to deploy it on cheap VPS instances. I have been running my own OpenClaw instance on a $6/month VPS for the past month, and it works surprisingly well.

This guide walks you through the entire setup — from spinning up a VPS to having OpenClaw running with Ollama for local inference, secured behind Nginx with SSL. No cloud AI API keys required.

## Why Self-Host OpenClaw?

Running OpenClaw on your local machine works fine, but a VPS gives you three things:

1. **Always-on availability** — Your AI agent is reachable 24/7 from any device. Send a WhatsApp message from your phone at 3 AM and get a response.
2. **No laptop dependency** — Close your MacBook, your agent keeps running.
3. **Isolated environment** — Security is [OpenClaw's biggest weakness](/openclaw-clawbot-the-ai-agent-taking-over/#the-security-problem). Running it on a dedicated VPS means a compromised agent cannot touch your personal files.

## What You Need

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores (ARM works great) |
| RAM | 2 GB (gateway only) | 8-16 GB (with Ollama) |
| Storage | 10 GB | 50-100 GB (for model weights) |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| Domain | Optional | Recommended for SSL |

**Cost breakdown:**
- **DigitalOcean / Hetzner / Vultr**: $6-12/month for a 4GB RAM droplet
- **Oracle Cloud Free Tier**: $0/month — 4 ARM cores, 24 GB RAM, 200 GB storage (seriously, this is the best deal in cloud computing)

If you want to run local models with Ollama, go with at least 8 GB RAM. If you plan to use an external API like Claude or GPT-4 as the backend, 2 GB is enough for the gateway.

## Step 1 — Initial Server Setup

SSH into your fresh VPS and lock it down first. Do not skip this — OpenClaw with shell access on an unsecured server is asking for trouble.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create a dedicated user (never run OpenClaw as root)
sudo adduser openclaw
sudo usermod -aG sudo openclaw

# Switch to the new user
su - openclaw
```

### Firewall Configuration

```bash
# Allow only SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verify — you should see only 22, 80, 443
sudo ufw status
```

### SSH Hardening

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Set these values:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Make sure you have your SSH key added to `~/.ssh/authorized_keys` before disabling password auth, or you will lock yourself out.

```bash
sudo systemctl restart sshd
```

### Install Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Step 2 — Install Docker

Docker is the cleanest way to run OpenClaw on a VPS. No Node.js version conflicts, easy updates, simple cleanup.

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker openclaw
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

## Step 3 — Install Ollama (Optional but Recommended)

If you want to run local models — no API keys, no external calls, completely private — install Ollama.

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model — Llama 3.1 8B is the sweet spot for most VPS setups
ollama pull llama3.1:8b

# For lower-RAM servers, use the 3B variant
# ollama pull llama3.2:3b
```

### Model Recommendations by RAM

| RAM | Model | Parameters | Quality |
|-----|-------|-----------|---------|
| 4 GB | Llama 3.2 3B | 3B | Basic, fast |
| 8 GB | Llama 3.1 8B | 8B | Good all-rounder |
| 8 GB | Qwen 3 8B | 8B | Strong reasoning |
| 16 GB | DeepSeek R1 14B | 14B | Excellent coding |
| 24 GB | Llama 3.1 70B (Q4) | 70B | Near cloud quality |

**Important:** Block Ollama's port from external access. It should only be reachable from localhost.

```bash
# Ollama listens on 11434 — make sure UFW blocks it externally
sudo ufw deny 11434/tcp
```

## Step 4 — Deploy OpenClaw with Docker Compose

Create the project directory and configuration:

```bash
mkdir -p ~/openclaw && cd ~/openclaw
```

Create the `docker-compose.yml`:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "127.0.0.1:11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_FLASH_ATTENTION=1
      - OLLAMA_NUM_PARALLEL=2
    deploy:
      resources:
        limits:
          memory: 8G

  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "127.0.0.1:18789:18789"
    volumes:
      - openclaw_data:/home/node/.openclaw
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - ollama

volumes:
  ollama_data:
  openclaw_data:
```

Key things to notice:
- Both ports bind to `127.0.0.1` only — not exposed to the internet
- Ollama gets a memory limit to prevent OOM kills
- Data is persisted in Docker volumes

### Start the Stack

```bash
docker compose up -d

# Check logs
docker compose logs -f openclaw
```

### Run the Onboarding Wizard

```bash
docker compose exec openclaw node dist/index.js onboard --mode local --no-install-daemon
```

This walks you through:
- Choosing your AI backend (select Ollama and point to `http://ollama:11434`)
- Connecting your messaging platform (WhatsApp, Telegram, etc.)
- Setting a gateway password

## Step 5 — Configure Nginx Reverse Proxy with SSL

You do not want to expose port 18789 directly. Put Nginx in front with SSL termination.

### Install Nginx and Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Create Nginx Config

Replace `openclaw.yourdomain.com` with your actual domain:

```bash
sudo nano /etc/nginx/sites-available/openclaw
```

```nginx
server {
    listen 80;
    server_name openclaw.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout — OpenClaw uses persistent connections
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Get SSL Certificate

```bash
sudo certbot --nginx -d openclaw.yourdomain.com
```

Certbot automatically modifies your Nginx config to redirect HTTP to HTTPS and adds the certificate paths. It also sets up auto-renewal.

## Step 6 — Security Hardening

This is not optional. OpenClaw has shell access on your server. Treat it like securing a bastion host.

### Set DM Policy to Closed

In `~/.openclaw/openclaw.json` (or via the Docker volume), set:

```json
{
  "gateway": {
    "binding": "loopback",
    "auth": {
      "password": "your-strong-password-here"
    }
  },
  "dm_policy": "closed",
  "sandbox": {
    "mode": "all",
    "scope": "session"
  }
}
```

- **`binding: loopback`** — Gateway only listens on 127.0.0.1
- **`dm_policy: closed`** — No one can message your agent unless explicitly allowed
- **`sandbox: all`** — All tool executions run in a sandbox

### Restrict Docker Capabilities

Update your `docker-compose.yml` to drop unnecessary Linux capabilities:

```yaml
  openclaw:
    # ... existing config ...
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### Run Security Audit

```bash
docker compose exec openclaw openclaw security audit --deep
```

Run this weekly. Set up a cron job:

```bash
crontab -e
```

Add:

```
0 3 * * 1 docker compose -f /home/openclaw/openclaw/docker-compose.yml exec -T openclaw openclaw security audit --deep >> /var/log/openclaw-audit.log 2>&1
```

### Do NOT Install Third-Party Skills

I cannot stress this enough. The ClawHub marketplace has had [hundreds of malicious skills](/openclaw-clawbot-the-ai-agent-taking-over/#the-security-problem) that passed initial review. On a VPS with no sandboxing beyond what you configure, a malicious skill can exfiltrate everything. Stick to bundled skills only.

## Step 7 — Connect Your Messaging Platform

### Telegram (Easiest)

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot, copy the token
3. Configure in OpenClaw:

```bash
docker compose exec openclaw openclaw config set telegram.bot_token "YOUR_BOT_TOKEN"
docker compose restart openclaw
```

### WhatsApp

WhatsApp requires the WhatsApp Business API or a bridge like Baileys. OpenClaw supports both:

```bash
docker compose exec openclaw openclaw config set whatsapp.mode "baileys"
```

Then scan the QR code from the logs:

```bash
docker compose logs openclaw | grep -A 5 "QR Code"
```

### Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Copy the bot token
3. Configure:

```bash
docker compose exec openclaw openclaw config set discord.bot_token "YOUR_BOT_TOKEN"
docker compose restart openclaw
```

## Maintenance

### Updating OpenClaw

```bash
cd ~/openclaw
docker compose pull
docker compose up -d
```

### Updating Ollama Models

```bash
ollama pull llama3.1:8b
```

### Monitoring

Check health endpoints:

```bash
curl http://localhost:18789/healthz
curl http://localhost:18789/readyz
```

Set up a simple uptime check with cron:

```bash
*/5 * * * * curl -sf http://localhost:18789/healthz || docker compose -f /home/openclaw/openclaw/docker-compose.yml restart >> /var/log/openclaw-health.log 2>&1
```

### Logs

```bash
# Real-time logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail 100 openclaw
```

## The Oracle Cloud Free Tier Setup

This deserves its own section because it is genuinely free and powerful enough to run OpenClaw with a decent local model.

Oracle Cloud Always Free Tier gives you:
- **4 ARM Ampere cores**
- **24 GB RAM**
- **200 GB block storage**
- **$0/month, forever**

With 24 GB of RAM, you can comfortably run Llama 3.1 70B at Q4 quantization — that is near cloud-API quality for zero cost.

The catch: ARM instances are in high demand. You might need to try multiple times or use a script to grab one when capacity opens up. Once you have it, the setup is identical to everything above — Ubuntu 24.04 on ARM runs Docker and Ollama perfectly.

## What I Actually Run

My setup:
- **Hetzner CX32** — 4 vCPUs, 8 GB RAM, 80 GB SSD — about $6.50/month
- **Ollama with Llama 3.1 8B** — good enough for 90% of tasks
- **Telegram as primary interface** — fast, reliable, works on every device
- **Claude API as fallback** — for complex coding tasks where 8B falls short

The total cost is under $10/month including the occasional Claude API call. For a 24/7 AI agent that I can message from anywhere, that is a bargain.

## Final Thoughts

Self-hosting OpenClaw on a VPS is the right move if you want an always-available AI agent without running it on your personal machine. The security isolation alone makes it worth the $6/month.

The key takeaways:

1. **Never expose OpenClaw directly** — always put it behind Nginx with SSL
2. **Lock down the server** — UFW, Fail2Ban, SSH keys only, dedicated user
3. **Use Ollama for privacy** — no data leaves your server
4. **Skip third-party skills** — the security risk is not worth it
5. **Oracle Cloud Free Tier** is the best bang for zero bucks if you can get an instance

OpenClaw is still young and the security model is still maturing. But running it on an isolated VPS, with proper hardening, makes it a useful tool rather than a liability. Just remember — treat this server like it is running untrusted code, because it is.
