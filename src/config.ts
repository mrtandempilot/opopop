/**
 * config.ts — Load and validate environment variables.
 */
import "dotenv/config";

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function loadConfig() {
    const telegramToken = requireEnv("TELEGRAM_BOT_TOKEN");
    const modelApiKey = requireEnv("MODEL_API_KEY");
    const allowlistRaw = requireEnv("TELEGRAM_ALLOWLIST_USER_ID");
    const claudeModel = process.env["CLAUDE_MODEL"] ?? "anthropic/claude-3.5-haiku";

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Gmail + Calendar + Drive — same credentials, optional
    const gmailClientId = process.env["GMAIL_CLIENT_ID"] ?? "";
    const gmailClientSecret = process.env["GMAIL_CLIENT_SECRET"] ?? "";
    const gmailRefreshToken = process.env["GMAIL_REFRESH_TOKEN"] ?? "";
    const gmailEnabled = Boolean(gmailClientId && gmailClientSecret && gmailRefreshToken);
    const calendarEnabled = gmailEnabled; // same token
    const driveEnabled = gmailEnabled; // same token

    const allowedUserIds = allowlistRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => {
            const parsed = parseInt(id, 10);
            if (isNaN(parsed)) throw new Error(`Invalid user ID in allowlist: "${id}"`);
            return parsed;
        });

    if (allowedUserIds.length === 0) {
        throw new Error("TELEGRAM_ALLOWLIST_USER_ID must contain at least one user ID.");
    }

    return {
        telegramToken,
        modelApiKey,
        claudeModel,
        allowedUserIds,
        supabaseUrl,
        supabaseKey,
        gmailClientId,
        gmailClientSecret,
        gmailRefreshToken,
        gmailEnabled,
        calendarEnabled,
        driveEnabled,
        weatherApiKey: process.env["OPENWEATHER_API_KEY"] || "",
        tavilyApiKey: process.env["TAVILY_API_KEY"] || "",
    } as const;
}

export const config = loadConfig();
