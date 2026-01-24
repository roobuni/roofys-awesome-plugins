/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "./styles.css";

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

let toastRoot: HTMLDivElement | null = null;
let progressFill: HTMLDivElement | null = null;
let percentText: HTMLSpanElement | null = null;
let iconWrapper: HTMLDivElement | null = null;
let progressInterval: NodeJS.Timeout | null = null;
let currentProgress = 0;

function createToastDOM(fileName: string, fileSize: number): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "vc-catbox-toast-container";
    container.innerHTML = `
        <div class="vc-catbox-toast-icon-wrapper">
            <div class="vc-catbox-toast-spinner"></div>
        </div>
        <div class="vc-catbox-toast-info">
            <div class="vc-catbox-toast-filename">${fileName}</div>
            <div class="vc-catbox-toast-meta">
                <span class="vc-catbox-toast-size">${formatSize(fileSize)}</span>
                <span class="vc-catbox-toast-percent">0%</span>
            </div>
            <div class="vc-catbox-toast-progress-track">
                <div class="vc-catbox-toast-progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
    return container;
}

function startProgressAnimation() {
    currentProgress = 0;
    progressInterval = setInterval(() => {
        if (currentProgress >= 95) return;

        if (currentProgress >= 90) {
            currentProgress += 0.3;
        } else if (currentProgress >= 70) {
            currentProgress += 0.8;
        } else if (currentProgress >= 50) {
            currentProgress += 1.5;
        } else {
            currentProgress += 3;
        }

        currentProgress = Math.min(currentProgress, 95);

        if (progressFill) progressFill.style.width = `${currentProgress}%`;
        if (percentText) percentText.textContent = `${Math.round(currentProgress)}%`;
    }, 50);
}

function showCheckmark() {
    if (iconWrapper) {
        iconWrapper.innerHTML = `
            <svg class="vc-catbox-toast-check" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#23a559" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
    if (progressFill) progressFill.style.width = "100%";
    if (percentText) percentText.textContent = "100%";
}

function cleanup() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    if (toastRoot) {
        toastRoot.innerHTML = "";
    }
}

export function showUploadToast(fileName: string, fileSize: number): { complete: () => void; error: () => void } {
    if (!toastRoot) {
        toastRoot = document.createElement("div");
        toastRoot.id = "vc-catbox-toast-root";
        document.body.appendChild(toastRoot);
    }

    cleanup();

    const toast = createToastDOM(fileName, fileSize);
    toastRoot.appendChild(toast);

    progressFill = toast.querySelector(".vc-catbox-toast-progress-fill");
    percentText = toast.querySelector(".vc-catbox-toast-percent");
    iconWrapper = toast.querySelector(".vc-catbox-toast-icon-wrapper");

    startProgressAnimation();

    return {
        complete: () => {
            if (progressInterval) clearInterval(progressInterval);
            showCheckmark();
            setTimeout(cleanup, 1500);
        },
        error: () => {
            cleanup();
        }
    };
}
