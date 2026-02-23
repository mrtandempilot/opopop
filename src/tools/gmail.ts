/**
 * tools/gmail.ts — Gmail MCP Adapter (read + send + attachments)
 *
 * Scopes: gmail.readonly, gmail.send
 */

import { google } from "googleapis";
import { config } from "../config.js";
import { PDFParse } from "pdf-parse";

// ─── Redact: sensitive fields not logged ────────────────────────────────────
const REDACTED = ["body", "snippet", "payload", "raw", "internalDate", "data"];

function safeLog(label: string, data: Record<string, unknown>) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
        clean[k] = REDACTED.includes(k) ? "[REDACTED]" : v;
    }
    console.log(`[gmail] ${label}`, JSON.stringify(clean));
}

// ─── OAuth2 client ─────────────────────────────────────────────────────────
function getOAuthClient() {
    const auth = new google.auth.OAuth2(
        config.gmailClientId,
        config.gmailClientSecret,
    );
    auth.setCredentials({ refresh_token: config.gmailRefreshToken });
    return auth;
}

// ─── Tool implementations ──────────────────────────────────────────────────

/**
 * List unread email subjects + senders + messageIds.
 */
export async function listUnreadEmails(maxResults = 5): Promise<string> {
    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) return "Okunmamış email yok.";

    const summaries: string[] = [];

    for (const msg of messages) {
        if (!msg.id) continue;

        const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From"],
        });

        const headers = detail.data.payload?.headers ?? [];
        const subject = headers.find(h => h.name === "Subject")?.value ?? "(konu yok)";
        const from = headers.find(h => h.name === "From")?.value ?? "(gönderen yok)";

        summaries.push(`• **${subject}** — ${from} (ID: ${msg.id})`);
    }

    return `📬 ${summaries.length} okunmamış email:\n${summaries.join("\n")}\n\n*İpucu: Bir mailin içeriğini veya ekini görmek için ID'sini kullanabilirsin.*`;
}

/**
 * List attachments for a specific message.
 */
export async function listAttachments(messageId: string): Promise<string> {
    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    try {
        const msg = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
        });

        const findAttachments = (parts: any[]): any[] => {
            let atts: any[] = [];
            for (const part of parts) {
                if (part.filename && part.body?.attachmentId) {
                    atts.push({
                        filename: part.filename,
                        attachmentId: part.body?.attachmentId,
                        mimeType: part.mimeType,
                        size: part.body?.size,
                    });
                }
                if (part.parts) {
                    atts = atts.concat(findAttachments(part.parts));
                }
            }
            return atts;
        };

        const attachments = findAttachments(msg.data.payload?.parts ?? []);

        if (attachments.length === 0) return "📎 Bu e-postada herhangi bir dosya eki bulunamadı.";

        const lines = attachments.map(a => `• ${a.filename} (${a.mimeType}, ${a.size} bytes) — ID: ${a.attachmentId}`);
        return `📎 Bu e-postada ${attachments.length} ek bulundu:\n${lines.join("\n")}`;
    } catch (err: any) {
        return `❌ Ekler listelenirken hata oluştu: ${err.message}`;
    }
}

/**
 * Read the content of an attachment (supports text and PDF).
 */
export async function getAttachmentContent(messageId: string, attachmentId: string): Promise<string> {
    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    try {
        // We need to find the filename and mimeType first to know if it's a PDF
        const msg = await gmail.users.messages.get({ userId: "me", id: messageId });
        const findPart = (parts: any[]): any => {
            for (const part of parts) {
                if (part.body?.attachmentId === attachmentId) return part;
                if (part.parts) {
                    const found = findPart(part.parts);
                    if (found) return found;
                }
            }
            return null;
        };
        const part = findPart(msg.data.payload?.parts ?? []);
        const mimeType = part?.mimeType ?? "";
        const filename = part?.filename ?? "unknown_file";

        const res = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId,
            id: attachmentId,
        });

        const data = res.data.data;
        if (!data) return "❌ Dosya içeriği boş veya alınamadı.";

        const buffer = Buffer.from(data, "base64url");
        let content = "";

        if (mimeType === "application/pdf") {
            try {
                const parser = new PDFParse({ data: buffer });
                const pdfData = await parser.getText();
                content = pdfData.text;
            } catch (pdfErr: any) {
                return `❌ PDF dosyası ayrıştırılamadı: ${pdfErr.message}`;
            }
        } else {
            content = buffer.toString("utf-8");
            if (content.includes("\ufffd") || content.length === 0) {
                return `❌ "${filename}" dosyası (tür: ${mimeType}) şimdilik doğrudan okunamıyor. Sadece metin tabanlı veya PDF eklerini okuyabilirim.`;
            }
        }

        if (content.trim().length === 0) {
            return `❌ "${filename}" dosyasının içeriği boş veya metin ayıklanamadı.`;
        }

        if (content.length > 5000) {
            content = content.substring(0, 5000) + "\n\n...(Dosya çok uzun olduğu için kırpıldı)...";
        }

        return `📄 **Dosya İçeriği (${filename}):**\n\n${content}`;
    } catch (err: any) {
        return `❌ Dosya okunurken hata oluştu: ${err.message}`;
    }
}

/**
 * Send an email.
 */
export async function sendEmail(input: {
    to: string;
    subject: string;
    body: string;
    confirmed?: boolean;
}): Promise<string> {
    if (!input.confirmed) {
        return [
            `📧 **Gönderim önizlemesi**`,
            `**Kime:** ${input.to}`,
            `**Konu:** ${input.subject}`,
            `**İçerik:**\n${input.body}`,
            `\n⚠️ Göndermemi onaylamak için "evet gönder" yaz.`,
        ].join("\n");
    }

    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    const raw = [
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        input.body,
    ].join("\r\n");
    const encoded = Buffer.from(raw).toString("base64url");

    await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
    });

    return `✅ Email gönderildi: ${input.to} — ${input.subject}`;
}

// ─── Tool definitions ──────────────────────────────────────────────────────

export const gmailListUnreadTool = {
    name: "gmail_list_unread",
    description: "Lists unread email subjects and senders. Use this to find messageIds.",
    input_schema: {
        type: "object" as const,
        properties: {
            max_results: { type: "number", description: "Max number of emails to return (max 10)." },
        },
        required: [],
    },
};

export const gmailListAttachmentsTool = {
    name: "gmail_list_attachments",
    description: "Lists all attachments in a specific email message. Requires a messageId.",
    input_schema: {
        type: "object" as const,
        properties: {
            messageId: { type: "string", description: "The ID of the Gmail message." },
        },
        required: ["messageId"],
    },
};

export const gmailReadAttachmentTool = {
    name: "gmail_read_attachment",
    description: "Reads the content of a specific email attachment. Requires messageId and attachmentId.",
    input_schema: {
        type: "object" as const,
        properties: {
            messageId: { type: "string", description: "The ID of the Gmail message." },
            attachmentId: { type: "string", description: "The ID of the attachment to read." },
        },
        required: ["messageId", "attachmentId"],
    },
};

export const gmailSendTool = {
    name: "gmail_send",
    description: "Sends an email. Shows preview first if confirmed=false.",
    input_schema: {
        type: "object" as const,
        properties: {
            to: { type: "string", description: "Recipient email." },
            subject: { type: "string", description: "Subject line." },
            body: { type: "string", description: "Email content." },
            confirmed: { type: "boolean", description: "Explicit confirmation flag." },
        },
        required: ["to", "subject", "body"],
    },
};

// ─── Tool executor ─────────────────────────────────────────────────────────

export async function executeGmailTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "gmail_list_unread":
            return listUnreadEmails(Math.min(Number(input.max_results ?? 5), 10));
        case "gmail_list_attachments":
            return listAttachments(String(input.messageId));
        case "gmail_read_attachment":
            return getAttachmentContent(String(input.messageId), String(input.attachmentId));
        case "gmail_send":
            return sendEmail({
                to: String(input.to),
                subject: String(input.subject),
                body: String(input.body),
                confirmed: Boolean(input.confirmed),
            });
        default:
            return `Bilinmeyen Gmail işlemi: ${name}`;
    }
}
