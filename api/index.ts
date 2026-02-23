import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";

// Polyfills for pdfjs-dist which is used by pdf-parse
// Vercel's Node environment lacks these browser globals
if (typeof (global as any).DOMMatrix === "undefined") {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor() { }
    };
}
if (typeof (global as any).ImageData === "undefined") {
    (global as any).ImageData = class ImageData {
        constructor() { }
    };
}
if (typeof (global as any).Path2D === "undefined") {
    (global as any).Path2D = class Path2D {
        constructor() { }
    };
}

let botInstance: any = null;
let handleUpdate: any = null;

export default async (req: any, res: any) => {
    // 1. Health check — should work even if bot fails
    if (req.method === "GET") {
        return res.status(200).send("🦞 Agent Claw Vercel Function is running. Send a POST request (webhook) to interact.");
    }

    // 2. Lazy initialization to catch startup errors
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
            stack: err.stack
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
