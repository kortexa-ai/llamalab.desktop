import { useState, useEffect } from "react";
import { X, Gear, Circle } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";
import type { AgentType } from "../../shared/types";

const AGENT_TYPES: { value: AgentType; label: string; desc: string }[] = [
    { value: "claude", label: "Claude", desc: "Most capable, full codebase access" },
    { value: "codex", label: "Codex", desc: "Focused coding tasks" },
    { value: "openclaw", label: "OpenClaw", desc: "Custom platform, messaging" },
    { value: "hermes", label: "Hermes", desc: "Multi-channel, persistent persona" },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
    const [defaultAgent, setDefaultAgent] = useState<AgentType>("claude");
    const [availability, setAvailability] = useState<Record<AgentType, boolean> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Load current settings and availability in parallel
        Promise.all([
            rpcRequest.getSettings({}),
            rpcRequest.checkAgentAvailability({}),
        ]).then(([settings, avail]) => {
            setDefaultAgent(settings.defaultAgentType);
            setAvailability(avail);
        });
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            await rpcRequest.updateSettings({ defaultAgentType: defaultAgent });
            // Notify the workspace about the change
            window.dispatchEvent(
                new CustomEvent("settingsChanged", { detail: { defaultAgentType: defaultAgent } }),
            );
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-surface rounded-lg shadow-xl border border-border w-[420px] max-w-[90vw]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <Gear size={16} className="text-accent" />
                        Settings
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-600"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-4">
                    {/* Default agent type */}
                    <div>
                        <label className="block text-2xs uppercase tracking-wider text-stone-500 font-medium mb-2">
                            Default Agent Type
                        </label>
                        {availability === null ? (
                            <div className="text-xs text-stone-400">Checking availability...</div>
                        ) : (
                            <div className="space-y-1.5">
                                {AGENT_TYPES.map((at) => {
                                    const available = availability[at.value];
                                    return (
                                        <button
                                            key={at.value}
                                            onClick={() => available && setDefaultAgent(at.value)}
                                            disabled={!available}
                                            className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded border text-xs transition-colors ${
                                                defaultAgent === at.value
                                                    ? "border-accent bg-accent-subtle text-accent"
                                                    : available
                                                        ? "border-border text-stone-600 hover:border-stone-400"
                                                        : "border-border text-stone-300 cursor-not-allowed"
                                            }`}
                                        >
                                            <Circle
                                                size={8}
                                                weight="fill"
                                                className={available ? "text-emerald-500" : "text-red-400"}
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{at.label}</div>
                                                <div className="text-2xs text-stone-400">{at.desc}</div>
                                            </div>
                                            {!available && (
                                                <span className="text-2xs text-stone-300">not installed</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
                    <button
                        onClick={onClose}
                        className="px-3 py-1 text-xs text-stone-600 hover:text-stone-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
