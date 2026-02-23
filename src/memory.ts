/**
 * memory.ts — Supabase database interactions + local log.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const MEMORY_LOG_PATH = resolve("memory/memory_log.md");

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

/**
 * Save a message to the conversation history.
 */
export async function saveMessage(userId: number, role: "user" | "assistant", content: string) {
    const { error } = await supabase.from("messages").insert({
        telegram_user_id: userId,
        role,
        content,
    });
    if (error) console.error("[memory] Error saving message:", error.message);
}

/**
 * Get recent conversation history for a user.
 */
export async function getHistory(userId: number, limit = 10): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from("messages")
        .select("role, content")
        .eq("telegram_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("[memory] Error fetching history:", error.message);
        return [];
    }

    // Reverse to get chronological order
    return data.map((m: any) => ({ role: m.role, content: m.content })).reverse();
}

/**
 * Save a piece of long-term memory.
 */
export async function saveMemory(userId: number, content: string) {
    const { error } = await supabase.from("memories").insert({
        telegram_user_id: userId,
        content,
    });
    if (error) throw error;

    // Also append to local memory log
    const timestamp = new Date().toISOString();
    const logLine = `- [${timestamp}] (user:${userId}) ${content}\n`;
    await appendFile(MEMORY_LOG_PATH, logLine, "utf8").catch(() => {
        // Non-fatal: log file may not exist yet
    });
}

/**
 * Search long-term memories using full-text search.
 */
export async function searchMemories(userId: number, query: string) {
    const { data, error } = await supabase
        .from("memories")
        .select("content")
        .eq("telegram_user_id", userId)
        .textSearch("fts", query)
        .limit(5);

    if (error) {
        console.error("[memory] Error searching memories:", error.message);
        return [];
    }
    return data.map((m: any) => m.content);
}
