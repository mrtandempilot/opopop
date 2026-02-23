/**
 * bot.ts — Telegram bot setup with history storage.
 */
import { Bot } from "grammy";
import { config } from "./config.js";
import { runAgentLoop } from "./agent.js";
import { saveMessage, saveMemory, searchMemories } from "./memory.js";

export function createBot() {
    const bot = new Bot(config.telegramToken);

    // Security: allowlist middleware
    bot.use(async (ctx, next) => {
        const userId = ctx.from?.id;
        if (userId === undefined || !config.allowedUserIds.includes(userId)) {
            return;
        }
        await next();
    });

    bot.command("start", async (ctx) => {
        await ctx.reply(
            "🦞 *Agent Claw online with Supabase Memory.*\n\nI remember our past chats and can save long-term facts!",
            { parse_mode: "Markdown" }
        );
    });

    bot.command("ping", async (ctx) => {
        await ctx.reply("🟢 Pong! Agent Claw is alive.");
    });

    // /remember <text> — explicitly store a memory
    bot.command("remember", async (ctx) => {
        if (!ctx.from) return;
        const text = ctx.match?.trim();
        if (!text) {
            await ctx.reply("❓ Kullanım: `/remember <hatırlatmak istediğin şey>`", { parse_mode: "Markdown" });
            return;
        }
        try {
            await saveMemory(ctx.from.id, text);
            await ctx.reply(`✅ *Kaydedildi:*\n_${text}_`, { parse_mode: "Markdown" });
        } catch (err) {
            console.error("[bot] /remember error:", err);
            await ctx.reply("⚠️ Kayıt sırasında bir hata oluştu.");
        }
    });

    // /recall <query> — search memories
    bot.command("recall", async (ctx) => {
        if (!ctx.from) return;
        const query = ctx.match?.trim();
        if (!query) {
            await ctx.reply("❓ Kullanım: `/recall <arama terimi>`", { parse_mode: "Markdown" });
            return;
        }
        try {
            const results = await searchMemories(ctx.from.id, query);
            if (results.length === 0) {
                await ctx.reply("🔍 Bu konuyla ilgili hafızamda bir şey bulamadım.");
            } else {
                const list = results.map((r, i) => `${i + 1}. ${r}`).join("\n");
                await ctx.reply(`🧠 *Hafızadan bulundu:*\n${list}`, { parse_mode: "Markdown" });
            }
        } catch (err) {
            console.error("[bot] /recall error:", err);
            await ctx.reply("⚠️ Arama sırasında bir hata oluştu.");
        }
    });

    // Handle text messages
    bot.on("message:text", async (ctx) => {
        const userId = ctx.from.id;
        const userText = ctx.message.text;

        // Save user message to DB
        await saveMessage(userId, "user", userText);

        // Show typing indicator
        await ctx.replyWithChatAction("typing");

        try {
            const reply = await runAgentLoop(userId, userText);

            // Save assistant reply to DB
            await saveMessage(userId, "assistant", reply);

            await ctx.reply(reply);
        } catch (err) {
            console.error("[bot] Agent loop error:", err instanceof Error ? err.message : err);
            await ctx.reply("⚠️ Something went wrong. Check the logs.");
        }
    });

    bot.catch((err) => {
        console.error("[bot] Unhandled error:", err.message);
    });

    return bot;
}
