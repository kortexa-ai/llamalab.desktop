import { useEffect, useState, useRef, useCallback } from "react";
import { Pencil, Eye, FloppyDisk } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";

export function FileEditor({
    programId,
    filePath,
    source,
}: {
    programId: string;
    filePath: string;
    source: "track" | "config" | "workspace";
}) {
    const [content, setContent] = useState<string | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        loadFile();
        setEditing(false);
        setDirty(false);
    }, [programId, filePath, source]);

    async function loadFile() {
        try {
            let result: { content: string; size: number };
            if (source === "workspace") {
                result = await rpcRequest.readWorkspaceFile({ filePath });
            } else {
                result = await rpcRequest.readFile({
                    programId,
                    filePath,
                    source,
                });
            }
            setContent(result.content);
            setEditContent(result.content);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Failed to load file");
        }
    }

    const save = useCallback(async () => {
        if (!dirty || saving) return;
        setSaving(true);
        try {
            if (source === "workspace") {
                await rpcRequest.writeWorkspaceFile({
                    filePath,
                    content: editContent,
                });
            } else {
                await rpcRequest.writeFile({
                    programId,
                    filePath,
                    content: editContent,
                    source,
                });
            }
            setContent(editContent);
            setDirty(false);
        } catch (err: any) {
            setError(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }, [dirty, saving, editContent, source, filePath, programId]);

    // Cmd+S to save
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (editing && dirty) save();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editing, dirty, save]);

    function enterEdit() {
        setEditing(true);
        setEditContent(content || "");
        setTimeout(() => textareaRef.current?.focus(), 0);
    }

    function cancelEdit() {
        setEditing(false);
        setEditContent(content || "");
        setDirty(false);
    }

    if (error) {
        return <div className="p-4 text-sm text-red-700">{error}</div>;
    }

    if (content === null) {
        return <div className="p-4 text-sm text-stone-400">Loading...</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-raised flex-shrink-0">
                <span className="text-2xs font-mono text-stone-500 truncate flex-1">
                    {filePath}
                </span>
                {editing ? (
                    <>
                        <button
                            onClick={save}
                            disabled={!dirty || saving}
                            className="flex items-center gap-1 px-2 py-0.5 text-2xs rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors"
                        >
                            <FloppyDisk size={10} />
                            {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1 px-2 py-0.5 text-2xs text-stone-500 hover:text-stone-700 transition-colors"
                        >
                            <Eye size={10} />
                            Cancel
                        </button>
                    </>
                ) : (
                    <button
                        onClick={enterEdit}
                        className="flex items-center gap-1 px-2 py-0.5 text-2xs text-stone-500 hover:text-stone-700 transition-colors"
                    >
                        <Pencil size={10} />
                        Edit
                    </button>
                )}
                {dirty && (
                    <span className="text-2xs text-amber-600">unsaved</span>
                )}
            </div>

            {/* Content */}
            {editing ? (
                <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => {
                        setEditContent(e.target.value);
                        setDirty(e.target.value !== content);
                    }}
                    className="flex-1 p-4 text-xs font-mono leading-relaxed text-stone-800 bg-surface resize-none outline-none"
                    spellCheck={false}
                />
            ) : (
                <div className="flex-1 overflow-auto">
                    <pre className="p-4 text-xs font-mono leading-relaxed text-stone-800 whitespace-pre">
                        {content}
                    </pre>
                </div>
            )}
        </div>
    );
}
