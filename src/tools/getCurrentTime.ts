/**
 * tools/getCurrentTime.ts — Demo tool.
 */
export const getCurrentTimeTool = {
    name: "get_current_time",
    description: "Returns the current date and time in ISO 8601 format (UTC).",
    input_schema: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
    },
};

export function executeGetCurrentTime(): string {
    return new Date().toISOString();
}
