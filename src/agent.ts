/**
 * agent.ts — Agentic loop with history and long-term memory.
 */
import OpenAI from "openai";
import { config } from "./config.js";
import { getCurrentTimeTool, executeGetCurrentTime } from "./tools/getCurrentTime.js";
import { saveMemoryTool, searchMemoriesTool } from "./tools/memoryTools.js";
import { getHistory, saveMemory, searchMemories } from "./memory.js";
import { gmailListUnreadTool, gmailListAttachmentsTool, gmailReadAttachmentTool, gmailSendTool, executeGmailTool } from "./tools/gmail.js";
import { calendarListEventsTool, calendarCreateEventTool, executeCalendarTool } from "./tools/calendar.js";
import { driveListFilesTool, driveSearchFilesTool, driveReadFileTool, executeDriveTool } from "./tools/drive.js";
import { weatherGetTool, executeWeatherTool } from "./tools/weather.js";
import { webSearchTool, executeWebSearchTool } from "./tools/webSearch.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function loadMemoryFile(relativePath: string): Promise<string> {
    try {
        return await readFile(resolve(relativePath), "utf8");
    } catch {
        return ""; // Dosya yoksa sessizce atla
    }
}

const MAX_ITERATIONS = 10;

async function buildSystemPrompt(): Promise<string> {
    const soul = await loadMemoryFile("memory/soul.md");
    const core = await loadMemoryFile("memory/core_memory.md");

    const base = `You are Agent Claw — a personal AI assistant running locally for your owner.
You have access to tools and will use them when needed.
You have a "messages" table for conversation context and a "memories" table for long-term facts.
Never reveal your API key or any secrets.`;

    const parts = [base];
    if (soul) parts.push(`--- SOUL & COMMUNICATION STYLE ---\n${soul}`);
    if (core) parts.push(`--- CORE MEMORY (stable preferences) ---\n${core}`);

    return parts.join("\n\n");
}

const allTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: getCurrentTimeTool.name,
            description: getCurrentTimeTool.description,
            parameters: getCurrentTimeTool.input_schema,
        },
    },
    {
        type: "function",
        function: {
            name: saveMemoryTool.name,
            description: saveMemoryTool.description,
            parameters: saveMemoryTool.input_schema,
        },
    },
    {
        type: "function",
        function: {
            name: searchMemoriesTool.name,
            description: searchMemoriesTool.description,
            parameters: searchMemoriesTool.input_schema,
        },
    },
    ...(config.gmailEnabled ? [
        { type: "function" as const, function: { name: gmailListUnreadTool.name, description: gmailListUnreadTool.description, parameters: gmailListUnreadTool.input_schema } },
        { type: "function" as const, function: { name: gmailListAttachmentsTool.name, description: gmailListAttachmentsTool.description, parameters: gmailListAttachmentsTool.input_schema } },
        { type: "function" as const, function: { name: gmailReadAttachmentTool.name, description: gmailReadAttachmentTool.description, parameters: gmailReadAttachmentTool.input_schema } },
        { type: "function" as const, function: { name: gmailSendTool.name, description: gmailSendTool.description, parameters: gmailSendTool.input_schema } },
    ] : []),
    ...(config.calendarEnabled ? [
        { type: "function" as const, function: { name: calendarListEventsTool.name, description: calendarListEventsTool.description, parameters: calendarListEventsTool.input_schema } },
        { type: "function" as const, function: { name: calendarCreateEventTool.name, description: calendarCreateEventTool.description, parameters: calendarCreateEventTool.input_schema } },
    ] : []),
    ...(config.driveEnabled ? [
        { type: "function" as const, function: { name: driveListFilesTool.name, description: driveListFilesTool.description, parameters: driveListFilesTool.input_schema } },
        { type: "function" as const, function: { name: driveSearchFilesTool.name, description: driveSearchFilesTool.description, parameters: driveSearchFilesTool.input_schema } },
        { type: "function" as const, function: { name: driveReadFileTool.name, description: driveReadFileTool.description, parameters: driveReadFileTool.input_schema } },
    ] : []),
    {
        type: "function" as const,
        function: {
            name: weatherGetTool.name,
            description: weatherGetTool.description,
            parameters: weatherGetTool.input_schema,
        },
    },
    {
        type: "function" as const,
        function: {
            name: webSearchTool.name,
            description: webSearchTool.description,
            parameters: webSearchTool.input_schema,
        },
    },
];

async function runTool(userId: number, name: string, input: any): Promise<string> {
    switch (name) {
        case "get_current_time":
            return executeGetCurrentTime();
        case "save_memory":
            await saveMemory(userId, input.content);
            return "Memory successfully saved.";
        case "search_memories":
            const results = await searchMemories(userId, input.query);
            return results.length > 0
                ? `Found these memories: ${results.join("; ")}`
                : "No relevant memories found.";
        case "gmail_list_unread":
        case "gmail_list_attachments":
        case "gmail_read_attachment":
        case "gmail_send":
            return executeGmailTool(name, input);
        case "calendar_list_events":
        case "calendar_create_event":
            return executeCalendarTool(name, input);
        case "drive_list_recent":
        case "drive_search":
        case "drive_read_file":
            return executeDriveTool(name, input);
        case "weather_get":
            return executeWeatherTool(name, input);
        case "web_search":
            return executeWebSearchTool(name, input);
        default:
            return `Unknown tool: ${name}`;
    }
}

export async function runAgentLoop(userId: number, userMessage: string): Promise<string> {
    const client = new OpenAI({
        apiKey: config.modelApiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "https://github.com/gravity-claw",
            "X-Title": "Gravity Claw",
        },
    });

    // Build system prompt with soul + core memory
    const systemPrompt = await buildSystemPrompt();

    // Fetch last 10 messages for context
    const history = await getHistory(userId, 10);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
        { role: "user", content: userMessage },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const response = await client.chat.completions.create({
            model: config.claudeModel,
            max_tokens: 1024,
            tools: allTools,
            messages,
        });

        const choice = response.choices[0];
        if (!choice) throw new Error("No choices returned from OpenRouter.");

        const assistantMsg = choice.message;
        messages.push(assistantMsg);

        if (choice.finish_reason === "stop" || !assistantMsg.tool_calls?.length) {
            return assistantMsg.content ?? "(no response)";
        }

        // Execute tool calls
        for (const toolCall of assistantMsg.tool_calls) {
            let input: Record<string, unknown> = {};
            try {
                input = JSON.parse(toolCall.function.arguments || "{}");
            } catch (parseErr) {
                console.error("[agent] Failed to parse tool args:", toolCall.function.arguments);
            }
            console.log(`[agent] Running tool: ${toolCall.function.name}`, JSON.stringify(input));
            let result: string;
            try {
                result = await runTool(userId, toolCall.function.name, input);
            } catch (toolErr) {
                console.error(`[agent] Tool ${toolCall.function.name} threw:`, toolErr);
                result = `Error running ${toolCall.function.name}: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`;
            }
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
            });
        }
    }

    return "⚠️ Agent reached max iterations without a final answer.";
}
