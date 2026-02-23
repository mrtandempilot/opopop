/**
 * tools/webSearch.ts — Web search tool using Tavily.
 */

import { config } from "../config.js";

export async function searchWeb(query: string): Promise<string> {
    if (!config.tavilyApiKey) {
        return "❌ Tavily API key is missing. Please set TAVILY_API_KEY in .env.";
    }

    try {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: config.tavilyApiKey,
                query: query,
                search_depth: "basic",
                include_answer: true,
                max_results: 5,
            }),
        });

        if (!response.ok) {
            return `❌ Arama başarısız oldu (Status: ${response.status})`;
        }

        const data: any = await response.json();

        // Tavily sometimes provides a direct 'answer'
        if (data.answer) {
            return `🔍 **Arama Sonucu:**\n${data.answer}\n\n*Kaynaklar:* ${data.results.map((r: any) => `[${r.title}](${r.url})`).join(", ")}`;
        }

        const results = data.results.map((r: any) => `• **[${r.title}](${r.url})**: ${r.content}`).join("\n\n");
        return `🔍 **"${query}" için arama sonuçları:**\n\n${results}`;
    } catch (err: any) {
        console.error("[webSearch] Error:", err.message);
        return "❌ Web araması yapılırken bir hata oluştu.";
    }
}

export const webSearchTool = {
    name: "web_search",
    description: "Searches the web for real-time information using Tavily API.",
    input_schema: {
        type: "object" as const,
        properties: {
            query: { type: "string", description: "The search query." },
        },
        required: ["query"],
    },
};

export async function executeWebSearchTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "web_search":
            return searchWeb(String(input.query));
        default:
            return `Bilinmeyen web_search işlemi: ${name}`;
    }
}
