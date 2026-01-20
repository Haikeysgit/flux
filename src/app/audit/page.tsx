"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ActivityLog } from "@/components/ActivityLog";
import { RefreshCw, ScrollText } from "lucide-react";

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

export default function AuditPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isMockMode, setIsMockMode] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    async function fetchLogs() {
        setIsLoading(true);
        try {
            const [logsRes, settingsRes] = await Promise.all([
                fetch("/api/logs"),
                fetch("/api/settings"),
            ]);

            const logsData = await logsRes.json();
            const settingsData = await settingsRes.json();

            if (logsData.success) {
                setLogs(logsData.logs);
            }
            if (settingsData.success) {
                setIsMockMode(settingsData.isMockMode);
            }
        } catch (error) {
            console.error("[AuditPage] Failed to fetch logs:", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            <Header isMockMode={isMockMode} />

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Page header */}
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                            <ScrollText size={20} className="text-zinc-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-zinc-100">
                                Audit Log
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                Complete history of all bot actions and decisions
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchLogs}
                        disabled={isLoading}
                        className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                {/* Explanation callout */}
                <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <h3 className="text-sm font-medium text-zinc-300">
                        Understanding the Audit Trail
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                        Every action taken by Flux is logged here with a detailed reason.
                        This provides full transparency into why accounts were reclaimed,
                        skipped, or protected. Use the filter to view real transactions vs
                        simulations.
                    </p>
                </div>

                {/* Activity log */}
                <ActivityLog logs={logs} isLoading={isLoading} />
            </main>
        </div>
    );
}
