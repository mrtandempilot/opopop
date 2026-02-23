/**
 * index.ts — Entry point for Gravity Claw.
 * Last reload: 2026-02-22T19:00 (PDF support added)
 */
import { createBot } from "./bot.js";
import { config } from "./config.js";

console.log("🦞 Gravity Claw starting...");
console.log("   Provider: OpenRouter");
console.log("   Memory:   Supabase");
console.log(`   Gmail:    ${config.gmailEnabled ? "✅ enabled" : "⚠️  disabled (no credentials)"}`);

const bot = createBot();

process.once("SIGINT", () => {
    console.log("\n🛑 Shutting down (SIGINT)...");
    void bot.stop();
});
process.once("SIGTERM", () => {
    console.log("\n🛑 Shutting down (SIGTERM)...");
    void bot.stop();
});

await bot.start({
    onStart: (info) => {
        console.log(`✅ Agent Claw is live as @${info.username}`);
    },
});
