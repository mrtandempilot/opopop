import "./polyfills.js";
import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";

let botInstance: any = null;
let handleUpdate: any = null;

export default async (req: any, res: any) => {
    // 1. Health check — should work now with polyfills
    if (req.method === "GET") {
        return res.status(200).send("🦞 Agent Claw Vercel Function is running. Polyfills applied.");
    }

    // 2. Lazy initialization
    try {
        if (!botInstance) {
            console.log("[vercel] Initializing bot...");
            botInstance = createBot();
            handleUpdate = webhookCallback(botInstance, "http");
            console.log("[vercel] Bot initialized successfully.");
        }
    } catch (err: any) {
        console.error("[vercel] CRITICAL: Bot initialization failed:", err.message);
        return res.status(500).json({
            error: "Bot Initialization Failed",
            message: err.message,
            stack: err.stack,
            env_verified: !!process.env.TELEGRAM_BOT_TOKEN
        });
    }

    // 3. Handle the webhook
    try {
        return await handleUpdate(req, res);
    } catch (err: any) {
        console.error("[vercel] Webhook processing failed:", err.message);
        return res.status(500).json({
            error: "Webhook processing error",
            message: err.message
        });
    }
};
