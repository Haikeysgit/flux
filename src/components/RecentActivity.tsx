"use client";

import {
    Search,
    ArrowDownToLine,
    SkipForward,
    Activity,
} from "lucide-react";

interface LogEntry {
    id: number;
    timestamp: string;
    action: string;
    account: string;
    amount: number;
    mode: string;
    reason: string | null;
}

interface RecentActivityProps {
    logs: LogEntry[];
}

const actionConfig: Record<
    string,
    { label: string; className: string; icon: React.ReactNode }
> = {
    SCAN: {
        label: "Scan",
        className: "bg-blue-500/10 text-blue-400",
        icon: <Search size={10} />,
    },
    RECLAIM: {
        label: "Reclaim",
        className: "bg-emerald-500/10 text-emerald-400",
        icon: <ArrowDownToLine size={10} />,
    },
    SKIP: {
        label: "Skip",
        className: "bg-zinc-500/10 text-zinc-400",
        icon: <SkipForward size={10} />,
    },
};

function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function truncateReason(reason: string | null): string {
    if (!reason) return "";
    if (reason.length <= 80) return reason;
    return reason.substring(0, 77) + "...";
}

export function RecentActivity({ logs }: RecentActivityProps) {
    return (
        <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
                <Activity size={16} className="text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-200">Recent Activity</h3>
                <span className="text-xs text-zinc-600">Live</span>
            </div>

            {logs.length === 0 ? (
                <div className="py-6 text-center">
                    <p className="text-xs text-zinc-600">No recent activity</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map((log) => {
                        const action = actionConfig[log.action] || actionConfig.SCAN;
                        return (
                            <div
                                key={log.id}
                                className="flex items-start gap-2 rounded-lg bg-zinc-900/50 p-2"
                            >
                                <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${action.className}`}
                                >
                                    {action.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium text-zinc-300">
                                            {action.label}
                                        </span>
                                        {log.amount > 0 && (
                                            <span className="font-mono text-[10px] text-zinc-500">
                                                {log.amount.toFixed(4)} SOL
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-[10px] text-zinc-600">
                                        {truncateReason(log.reason)}
                                    </p>
                                </div>
                                <span className="shrink-0 text-[10px] text-zinc-600">
                                    {formatTimeAgo(log.timestamp)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
