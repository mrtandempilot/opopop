# 🦞 Gravity Claw — Level 1: Foundation

Personal AI assistant bot on Telegram, powered by Claude. Runs locally on bare-metal Windows/Node.js — no Docker, no exposed ports.

## Folder Structure

```
gravity-claw/
├── src/
│   ├── index.ts          ← Entry point
│   ├── config.ts         ← Env loading & validation
│   ├── bot.ts            ← Telegram bot (grammy)
│   ├── agent.ts          ← Agentic loop (Claude + tools)
│   └── tools/
│       └── getCurrentTime.ts
├── .env.example          ← Copy → .env, fill in keys
├── .gitignore
├── package.json
└── tsconfig.json
```

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **A Telegram bot token** — create one via [@BotFather](https://t.me/BotFather) (`/newbot`)
- **Your Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **Your Telegram user ID** — send a message to [@userinfobot](https://t.me/userinfobot)

## Setup

```powershell
# 1. Go to the project folder
cd C:\Users\mrtan\.gemini\antigravity\scratch\gravity-claw

# 2. Copy the env template and fill in your real values
copy .env.example .env
notepad .env

# 3. Install dependencies
npm install

# 4. Run in dev mode (auto-restarts on file changes)
npm run dev
```

Your `.env` should look like:
```
TELEGRAM_BOT_TOKEN=7123456789:AAF...
MODEL_API_KEY=sk-ant-...
TELEGRAM_ALLOWLIST_USER_ID=123456789
```

## Running

```powershell
# Development (auto-reload on save)
npm run dev

# Production
npm start
```

## ✅ Self-Test Checklist

Once the bot is running, confirm all of these pass:

| # | Test | Expected result |
|---|------|-----------------|
| 1 | Terminal shows `✅ Agent Claw is live as @YourBotName` | Bot connected to Telegram |
| 2 | Send `/ping` to your bot | Reply: `🟢 Pong! Agent Claw is alive.` |
| 3 | Send `/start` | Welcome message with bot description |
| 4 | Send `What time is it?` | Claude calls `get_current_time` tool and replies with the current UTC time |
| 5 | Send a general question (e.g., `What is 7 × 8?`) | Claude replies directly: `56` |
| 6 | Send a message from a **different** Telegram account | Bot is completely silent (no reply, no error) |

## Security Notes

- The bot uses **long-polling** — no ports opened, no web server.
- **Allowlist only** — unknown users get silently ignored.
- Your **API keys are never logged** anywhere.
- The `.env` file is in `.gitignore` and will never be committed.

## What's Next (Level 2)

Persistent memory with SQLite + FTS5 so Agent Claw remembers past conversations.
