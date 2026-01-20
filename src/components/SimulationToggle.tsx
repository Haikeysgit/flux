"use client";

import { useState } from "react";
import { AlertTriangle, Play, Shield, ShieldCheck } from "lucide-react";

interface SimulationToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    disabled?: boolean;
}

export function SimulationToggle({
    enabled,
    onToggle,
    disabled = false,
}: SimulationToggleProps) {
    return (
        <div className="card p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {enabled ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                            <ShieldCheck size={20} className="text-emerald-500" />
                        </div>
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                            <AlertTriangle size={20} className="text-amber-500" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-100">
                            {enabled ? "Simulation Mode" : "Live Mode"}
                        </h3>
                        <p className="text-xs text-zinc-500">
                            {enabled
                                ? "Transactions are simulated, no real transfers"
                                : "Real transactions will be executed"}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => onToggle(!enabled)}
                    disabled={disabled}
                    className={`relative h-7 w-12 rounded-full transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        } ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                    aria-label={enabled ? "Disable simulation mode" : "Enable simulation mode"}
                >
                    <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "left-6" : "left-1"
                            }`}
                    />
                </button>
            </div>

            {!enabled && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/5 p-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-500/90">
                        Live mode is active. Reclaim actions will execute real blockchain transactions.
                    </p>
                </div>
            )}
        </div>
    );
}
