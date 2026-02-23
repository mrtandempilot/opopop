/**
 * tools/memoryTools.ts — Tools for saving and searching long-term memories.
 */

export const saveMemoryTool = {
    name: "save_memory",
    description: "Saves a piece of information to long-term memory for later retrieval.",
    input_schema: {
        type: "object" as const,
        properties: {
            content: {
                type: "string",
                description: "The information to remember (be specific).",
            },
        },
        required: ["content"],
    },
};

export const searchMemoriesTool = {
    name: "search_memories",
    description: "Searches long-term memory for relevant information using a query.",
    input_schema: {
        type: "object" as const,
        properties: {
            query: {
                type: "string",
                description: "The topic or keyword to search for.",
            },
        },
        required: ["query"],
    },
};
