/**
 * tools/calendar.ts — Google Calendar MCP Adapter
 *
 * Scopes: calendar.events (read + write to primary calendar)
 * Guardrails:
 *   - Create: sadece başlık/zaman/konum — katılımcı ekleme yok
 *   - Read: başlık, zaman, yer — private alanlar redact
 */

import { google } from "googleapis";
import { config } from "../config.js";

function getOAuthClient() {
    const auth = new google.auth.OAuth2(
        config.gmailClientId,
        config.gmailClientSecret,
    );
    auth.setCredentials({ refresh_token: config.gmailRefreshToken });
    return auth;
}

/**
 * List upcoming calendar events (no attendees/private fields sent to AI)
 */
export async function listUpcomingEvents(days = 7): Promise<string> {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 10,
        // Only request safe fields — no attendee data
        fields: "items(summary,start,end,location,status)",
    });

    const events = res.data.items ?? [];
    if (events.length === 0) return `📅 Önümüzdeki ${days} gün içinde etkinlik yok.`;

    const lines = events.map(e => {
        const start = e.start?.dateTime
            ? new Date(e.start.dateTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
            : e.start?.date ?? "?";
        const location = e.location ? ` 📍 ${e.location}` : "";
        return `• ${e.summary ?? "(başlıksız)"} — ${start}${location}`;
    });

    return `📅 Önümüzdeki ${days} gün (${events.length} etkinlik):\n${lines.join("\n")}`;
}

// ─── Tool definitions ──────────────────────────────────────────────────────

export const calendarListEventsTool = {
    name: "calendar_list_events",
    description: "Lists upcoming calendar events for the next N days.",
    input_schema: {
        type: "object" as const,
        properties: {
            days: { type: "number", description: "Days to look ahead (default 7, max 30)." },
        },
        required: [],
    },
};

export const calendarCreateEventTool = {
    name: "calendar_create_event",
    description: "Creates a new event on the user's primary Google Calendar. Always confirm details with the user before calling.",
    input_schema: {
        type: "object" as const,
        properties: {
            summary: { type: "string", description: "Event title." },
            start: { type: "string", description: "Start time in ISO 8601 (e.g. 2026-02-23T15:00:00+03:00)." },
            end: { type: "string", description: "End time in ISO 8601. If not given, defaults to 1 hour after start." },
            location: { type: "string", description: "Optional location." },
            description: { type: "string", description: "Optional notes/description." },
        },
        required: ["summary", "start"],
    },
};

export async function createCalendarEvent(input: {
    summary: string;
    start: string;
    end?: string;
    location?: string;
    description?: string;
}): Promise<string> {
    console.log("[calendar] createCalendarEvent called:", JSON.stringify(input));
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const startDt = new Date(input.start);
    const endDt = input.end
        ? new Date(input.end)
        : new Date(startDt.getTime() + 60 * 60 * 1000);

    try {
        const res = await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
                summary: input.summary,
                // Only include optional fields if they have values
                ...(input.location ? { location: input.location } : {}),
                ...(input.description ? { description: input.description } : {}),
                start: { dateTime: startDt.toISOString(), timeZone: "Europe/Istanbul" },
                end: { dateTime: endDt.toISOString(), timeZone: "Europe/Istanbul" },
            },
        });

        const link = res.data.htmlLink ?? "";
        const startStr = startDt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
        console.log("[calendar] Event created:", link);
        return `✅ Etkinlik oluşturuldu: ${input.summary} — ${startStr}\n🔗 ${link}`;
    } catch (err: any) {
        console.error("[calendar] createCalendarEvent error:", err?.message, "code:", err?.code, "status:", err?.status);
        throw err;
    }
}

// ─── Executor ──────────────────────────────────────────────────────────────

export async function executeCalendarTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "calendar_list_events":
            const days = Math.min(Number(input.days ?? 7), 30);
            return listUpcomingEvents(days);
        case "calendar_create_event":
            return createCalendarEvent({
                summary: String(input.summary),
                start: String(input.start),
                ...(input.end ? { end: String(input.end) } : {}),
                ...(input.location ? { location: String(input.location) } : {}),
                ...(input.description ? { description: String(input.description) } : {}),
            });
        default:
            return `Bilinmeyen Calendar işlemi: ${name}`;
    }
}
