import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";

const bot = createBot();

// Vercel expects a default export for the serverless function
export default webhookCallback(bot, "std/http");
