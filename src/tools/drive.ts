/**
 * tools/drive.ts — Google Drive Adapter (read-only)
 *
 * Scope: drive.readonly
 */

import { google } from "googleapis";
import { config } from "../config.js";
// PDFParse will be imported dynamically when needed

function getOAuthClient() {
    const auth = new google.auth.OAuth2(
        config.gmailClientId,
        config.gmailClientSecret,
    );
    auth.setCredentials({ refresh_token: config.gmailRefreshToken });
    return auth;
}

const SAFE_FIELDS = "files(id,name,mimeType,modifiedTime,webViewLink,size)";

function mimeLabel(mime: string): string {
    const map: Record<string, string> = {
        "application/vnd.google-apps.document": "📝 Döküman",
        "application/vnd.google-apps.spreadsheet": "📊 Tablo",
        "application/vnd.google-apps.presentation": "📽 Sunu",
        "application/vnd.google-apps.folder": "📁 Klasör",
        "application/pdf": "📄 PDF",
    };
    return map[mime] ?? "📎 Dosya";
}

/**
 * List recently modified files
 */
export async function listRecentFiles(max = 5): Promise<string> {
    const auth = getOAuthClient();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
        pageSize: Math.min(max, 10),
        orderBy: "modifiedTime desc",
        fields: SAFE_FIELDS,
        q: "trashed = false",
    });

    const files = res.data.files ?? [];
    if (files.length === 0) return "📁 Drive'da dosya bulunamadı.";

    const lines = files.map(f => {
        const date = f.modifiedTime
            ? new Date(f.modifiedTime).toLocaleDateString("tr-TR")
            : "?";
        const type = mimeLabel(f.mimeType ?? "");
        return `• ${type} [${f.name}](${f.webViewLink}) — ${date} (ID: ${f.id})`;
    });

    return `📁 Drive'da son ${files.length} dosya:\n${lines.join("\n")}`;
}

/**
 * Search files by name
 */
export async function searchDriveFiles(query: string): Promise<string> {
    const auth = getOAuthClient();
    const drive = google.drive({ version: "v3", auth });

    const safeQuery = query.replace(/'/g, "\\'");
    const res = await drive.files.list({
        pageSize: 8,
        fields: SAFE_FIELDS,
        q: `name contains '${safeQuery}' and trashed = false`,
    });

    const files = res.data.files ?? [];
    if (files.length === 0) return `🔍 "${query}" için Drive'da sonuç bulunamadı.`;

    const lines = files.map(f => {
        const type = mimeLabel(f.mimeType ?? "");
        return `• ${type} [${f.name}](${f.webViewLink}) (ID: ${f.id})`;
    });

    return `🔍 "${query}" için ${files.length} sonuç:\n${lines.join("\n")}`;
}

/**
 * Read file content (supports Google Docs, text files, and PDF)
 */
export async function readFileContent(fileId: string): Promise<string> {
    const auth = getOAuthClient();
    const drive = google.drive({ version: "v3", auth });

    try {
        const meta = await drive.files.get({ fileId, fields: "name,mimeType" });
        const name = meta.data.name ?? "unnamed";
        const mime = meta.data.mimeType ?? "";

        let content = "";

        if (mime === "application/vnd.google-apps.document") {
            const res = await drive.files.export({
                fileId,
                mimeType: "text/plain",
            });
            content = String(res.data);
        } else if (mime === "application/pdf") {
            // Download binary PDF and parse
            const res = await drive.files.get({
                fileId,
                alt: "media",
            }, { responseType: "arraybuffer" });

            const buffer = Buffer.from(res.data as ArrayBuffer);
            try {
                // Dynamic import to avoid startup issues on Vercel
                const { PDFParse } = await import("pdf-parse");
                const parser = new PDFParse({ data: buffer });
                const pdfData = await parser.getText();
                content = pdfData.text;
            } catch (pdfErr: any) {
                return `❌ PDF dosyası ayrıştırılamadı: ${pdfErr.message}`;
            }
        } else if (mime.startsWith("text/") || mime === "application/json" || mime === "application/javascript") {
            const res = await drive.files.get({
                fileId,
                alt: "media",
            });
            content = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        } else {
            return `❌ "${name}" dosyasının türü (${mime}) şimdilik doğrudan okunmayı desteklemiyor. Sadece metin belgelerini, Google Dokümanlarını ve PDF'leri okuyabilirim.`;
        }

        if (content.trim().length === 0) {
            return `❌ "${name}" dosyasının içeriği boş veya metin ayıklanamadı.`;
        }

        if (content.length > 5000) {
            content = content.substring(0, 5000) + "\n\n...(Dosya çok uzun olduğu için kırpıldı)...";
        }

        return `📄 **Dosya İçeriği (${name}):**\n\n${content}`;
    } catch (err: any) {
        console.error("[drive] Read error:", err.message);
        return `❌ Dosya okunurken hata oluştu: ${err.message}`;
    }
}

// ─── Tool definitions ──────────────────────────────────────────────────────

export const driveListFilesTool = {
    name: "drive_list_recent",
    description: "Lists recently modified Google Drive files.",
    input_schema: {
        type: "object" as const,
        properties: {
            max: { type: "number", description: "Max files to return (default 5, max 10)." },
        },
        required: [],
    },
};

export const driveSearchFilesTool = {
    name: "drive_search",
    description: "Searches Google Drive files by name.",
    input_schema: {
        type: "object" as const,
        properties: {
            query: { type: "string", description: "Search term to match against file names." },
        },
        required: ["query"],
    },
};

export const driveReadFileTool = {
    name: "drive_read_file",
    description: "Reads the text content of a Google Drive file (Google Docs, PDF, or text files).",
    input_schema: {
        type: "object" as const,
        properties: {
            fileId: { type: "string", description: "The ID of the file to read." },
        },
        required: ["fileId"],
    },
};

// ─── Executor ──────────────────────────────────────────────────────────────

export async function executeDriveTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "drive_list_recent":
            return listRecentFiles(Math.min(Number(input.max ?? 5), 10));
        case "drive_search":
            return searchDriveFiles(String(input.query ?? ""));
        case "drive_read_file":
            return readFileContent(String(input.fileId));
        default:
            return `Bilinmeyen Drive işlemi: ${name}`;
    }
}
