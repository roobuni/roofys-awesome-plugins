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

import { classNameFactory } from "@api/Styles";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Forms, useState, useEffect, useMemo } from "@webpack/common";

const cl = classNameFactory("vc-catbox-preview-");

interface CatboxPreviewModalProps {
    rootProps: ModalProps;
    file: File;
    onConfirm: (file: File) => void;
    close: () => void;
}

export function CatboxPreviewModal({ rootProps, file, onConfirm, close }: CatboxPreviewModalProps) {
    const [isUploading, setIsUploading] = useState(false);

    const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

    useEffect(() => {
        return () => URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const handleSubmit = () => {
        if (isUploading) return;
        setIsUploading(true);
        onConfirm(file);
        close();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !isUploading) {
                e.preventDefault();
                handleSubmit();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isUploading]);

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader className={cl("header")}>
                <Forms.FormTitle tag="h2" className={cl("title")}>Upload to Catbox</Forms.FormTitle>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent className={cl("content")}>
                <div className={cl("video-container")}>
                    <video
                        src={previewUrl}
                        controls
                        autoPlay
                        muted
                        className={cl("video")}
                    />
                </div>

                <div className={cl("file-info")}>
                    <span className={cl("file-name")}>{file.name}</span>
                    <span className={cl("file-size")}>{formatFileSize(file.size)}</span>
                </div>
            </ModalContent>

            <ModalFooter className={cl("footer")}>
                <button className={cl("btn-cancel")} onClick={close}>
                    Cancel
                </button>
                <button
                    className={cl("btn-upload")}
                    onClick={handleSubmit}
                    disabled={isUploading}
                >
                    {isUploading ? "Uploading..." : "Upload"}
                </button>
            </ModalFooter>
        </ModalRoot>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
