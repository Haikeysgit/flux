"use client";

import {
    Search,
    ArrowDownToLine,
    SkipForward,
    ExternalLink,
    Filter,
} from "lucide-react";
import { useState } from "react";

interface LogEntry {
    id: number;
    timestamp: string;
    action: string;
    account: string;
    amount: number;
    mode: string;
    txSignature: string | null;
    reason: string | null;
}

interface ActivityLogProps {
    logs: LogEntry[];
    isLoading?: boolean;
}

const actionConfig: Record<
    string,
    { label: string; className: string; icon: React.ReactNode }
> = {
    SCAN: {
        label: "Scan",
        className: "action-scan",
        icon: <Search size={12} />,
    },
    RECLAIM: {
        label: "Reclaim",
        className: "action-reclaim",
        icon: <ArrowDownToLine size={12} />,
    },
    SKIP: {
        label: "Skip",
        className: "action-skip",
        icon: <SkipForward size={12} />,
    },
};

function truncateAddress(address: string): string {
    if (address === "-" || address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function ActivityLog({ logs, isLoading = false }: ActivityLogProps) {
    const [filter, setFilter] = useState<"all" | "REAL" | "SIMULATION">("all");

    const filteredLogs =
        filter === "all" ? logs : logs.filter((log) => log.mode === filter);

    return (
        <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-2">
                <Filter size={16} className="text-zinc-500" />
                <div className="flex rounded-lg bg-zinc-900 p-1">
                    {(["all", "REAL", "SIMULATION"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setFilter(mode)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === mode
                                    ? "bg-zinc-800 text-zinc-100"
                                    : "text-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {mode === "all" ? "All" : mode === "REAL" ? "Real" : "Simulation"}
                        </button>
                    ))}
                </div>
                <span className="ml-2 text-xs text-zinc-600">
                    {filteredLogs.length} entries
                </span>
            </div>

            {/* Log entries */}
            <div className="card divide-y divide-zinc-800">
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center">
                        <Search size={40} className="mx-auto text-zinc-600" />
                        <p className="mt-4 text-sm text-zinc-500">No activity logs found</p>
                    </div>
                ) : (
                    filteredLogs.map((log) => {
                        const action = actionConfig[log.action] || actionConfig.SCAN;

                        return (
                            <div
                                key={log.id}
                                className="flex items-start gap-4 p-4 transition-colors hover:bg-zinc-800/30"
                            >
                                {/* Action badge */}
                                <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.className}`}
                                >
                                    {action.icon}
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-zinc-200">
                                            {action.label}
                                        </span>
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${log.mode === "REAL"
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : "bg-zinc-800 text-zinc-500"
                                                }`}
                                        >
                                            {log.mode}
                                        </span>
                                        {log.amount > 0 && (
                                            <span className="font-mono text-xs text-zinc-400">
                                                {log.amount.toFixed(6)} SOL
                                            </span>
                                        )}
                                    </div>

                                    {log.account !== "-" && (
                                        <div className="mt-1 flex items-center gap-2">
                                            <code className="font-mono text-xs text-zinc-500">
                                                {truncateAddress(log.account)}
                                            </code>
                                            {log.txSignature && (
                                                <a
                                                    href={`https://explorer.solana.com/tx/${log.txSignature}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                                                >
                                                    View tx
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {log.reason && (
                                        <p className="mt-1.5 text-xs text-zinc-500">{log.reason}</p>
                                    )}
                                </div>

                                {/* Timestamp */}
                                <div className="shrink-0 text-right">
                                    <span className="text-xs text-zinc-600">
                                        {formatTimestamp(log.timestamp)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
