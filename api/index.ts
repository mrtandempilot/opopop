import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";

const bot = createBot();

// standard http adapter for Node.js serverless functions
const handleUpdate = webhookCallback(bot, "http");

export default async (req: any, res: any) => {
    // Health check for browser
    if (req.method === "GET") {
        return res.status(200).send("🦞 Agent Claw is alive and waiting for webhooks!");
    }

    try {
        return await handleUpdate(req, res);
    } catch (err: any) {
        console.error("[vercel-api] Webhook error:", err.message);
        return res.status(500).send("Internal Server Error");
    }
};
