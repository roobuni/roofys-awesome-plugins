/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const CATBOX_API_URL = "https://catbox.moe/user/api.php";

export async function uploadToCatbox(
    _: IpcMainInvokeEvent,
    fileData: string,
    fileName: string,
    mimeType: string,
    userhash?: string
): Promise<{ success: boolean; url?: string; error?: string; }> {
    try {
        const buffer = Buffer.from(fileData, "base64");
        const boundary = "----VencordCatboxBoundary" + Date.now().toString(16);

        let body = "";
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="reqtype"\r\n\r\n`;
        body += `fileupload\r\n`;

        if (userhash && userhash.trim()) {
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="userhash"\r\n\r\n`;
            body += `${userhash.trim()}\r\n`;
        }

        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="fileToUpload"; filename="${fileName}"\r\n`;
        body += `Content-Type: ${mimeType}\r\n\r\n`;

        const textEncoder = new TextEncoder();
        const textPart = textEncoder.encode(body);
        const endPart = textEncoder.encode(`\r\n--${boundary}--\r\n`);

        const fullBody = Buffer.concat([
            Buffer.from(textPart),
            buffer,
            Buffer.from(endPart)
        ]);

        const res = await fetch(CATBOX_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: fullBody
        });

        const responseText = await res.text();

        if (!res.ok) {
            return {
                success: false,
                error: `HTTP ${res.status}: ${responseText}`
            };
        }

        if (!responseText.startsWith("https://")) {
            return {
                success: false,
                error: `Invalid response: ${responseText}`
            };
        }

        return {
            success: true,
            url: responseText.trim()
        };
    } catch (e) {
        return {
            success: false,
            error: String(e)
        };
    }
}