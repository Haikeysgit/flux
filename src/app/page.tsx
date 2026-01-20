"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { StatsCard } from "@/components/StatsCard";
import { SimulationToggle } from "@/components/SimulationToggle";
import { AccountsTable } from "@/components/AccountsTable";
import { RecentActivity } from "@/components/RecentActivity";
import {
  Wallet,
  TrendingUp,
  Shield,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  Coins,
} from "lucide-react";

interface Account {
  address: string;
  balance: number;
  rentExemptMin: number;
  lastActivity: string;
  status: string;
  detectedAt: string;
}

interface Stats {
  totalRecovered: number;
  potentialRecovery: number;
  eligibleCount: number;
  protectedCount: number;
  activeCount: number;
}

interface Settings {
  min_age_days: string;
  dry_run_mode: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
  account: string;
  amount: number;
  mode: string;
  reason: string | null;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [isMockMode, setIsMockMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [accountsRes, statsRes, settingsRes, logsRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/stats"),
        fetch("/api/settings"),
        fetch("/api/logs?limit=3"),
      ]);

      const accountsData = await accountsRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();
      const logsData = await logsRes.json();

      if (accountsData.success) {
        setAccounts(accountsData.accounts);
      }
      if (statsData.success) {
        setStats(statsData.stats);
        setIsMockMode(statsData.isMockMode);
      }
      if (settingsData.success) {
        setSettings(settingsData.settings);
        setIsMockMode(settingsData.isMockMode);
      }
      if (logsData.success) {
        setRecentLogs(logsData.logs);
      }
    } catch (error) {
      console.error("[Dashboard] Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScan() {
    setIsScanning(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      console.log("[Dashboard] Scan result:", data);
      // Refresh data after scan
      await fetchData();
    } catch (error) {
      console.error("[Dashboard] Scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleReclaim(address: string) {
    setIsReclaiming(true);
    try {
      const res = await fetch("/api/reclaim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      console.log("[Dashboard] Reclaim result:", data);
      // Refresh data after reclaim
      await fetchData();
    } catch (error) {
      console.error("[Dashboard] Reclaim failed:", error);
    } finally {
      setIsReclaiming(false);
    }
  }

  async function handleToggleSimulation(enabled: boolean) {
    console.log('[Dashboard] Toggling simulation mode to:', enabled);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "dry_run_mode", value: String(enabled) }),
      });
      const data = await res.json();
      console.log('[Dashboard] Toggle response:', data);
      if (data.success) {
        setSettings((prev) =>
          prev ? { ...prev, dry_run_mode: String(enabled) } : null
        );
        console.log('[Dashboard] Local state updated, dry_run_mode =', String(enabled));
      }
    } catch (error) {
      console.error("[Dashboard] Failed to toggle simulation:", error);
    }
  }

  const simulationEnabled = settings?.dry_run_mode !== "false";

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header isMockMode={isMockMode} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-100">Dashboard</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Monitor and manage sponsored account rent reclamation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <Search size={16} className={isScanning ? "animate-pulse" : ""} />
              {isScanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>
        </div>

        {/* Large Idle Rent Alert - Triggers when significant SOL is reclaimable */}
        {stats && stats.potentialRecovery > 0.5 && stats.eligibleCount > 0 && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                  <Coins size={20} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-500">
                    Large Idle Rent Detected
                  </p>
                  <p className="text-xs text-amber-500/70">
                    {stats.potentialRecovery.toFixed(6)} SOL available across{" "}
                    {stats.eligibleCount} eligible accounts
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setIsReclaiming(true);
                  try {
                    const res = await fetch("/api/reclaim", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ all: true }),
                    });
                    const data = await res.json();
                    console.log("[Dashboard] Reclaim all result:", data);
                    await fetchData();
                  } catch (error) {
                    console.error("[Dashboard] Reclaim all failed:", error);
                  } finally {
                    setIsReclaiming(false);
                  }
                }}
                disabled={isReclaiming}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AlertTriangle size={16} />
                {isReclaiming ? "Processing..." : "Reclaim All"}
              </button>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Recovered"
            value={`${stats?.totalRecovered.toFixed(4) || "0.0000"} SOL`}
            subtitle="Lifetime reclaimed rent"
            icon={Wallet}
            variant="success"
          />
          <StatsCard
            title="Potential Recovery"
            value={`${stats?.potentialRecovery.toFixed(4) || "0.0000"} SOL`}
            subtitle={`${stats?.eligibleCount || 0} eligible accounts`}
            icon={TrendingUp}
            variant="warning"
          />
          <StatsCard
            title="Protected"
            value={stats?.protectedCount || 0}
            subtitle="Accounts with user funds"
            icon={Shield}
            variant="info"
          />
          <StatsCard
            title="Active"
            value={stats?.activeCount || 0}
            subtitle="Recently used accounts"
            icon={Clock}
          />
        </div>

        {/* Simulation toggle and Recent Activity */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <SimulationToggle
            enabled={simulationEnabled}
            onToggle={handleToggleSimulation}
          />
          <RecentActivity logs={recentLogs} />
        </div>

        {/* Accounts table */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-zinc-100">
              Sponsored Accounts
            </h3>
            <span className="text-sm text-zinc-500">
              {accounts.length} total
            </span>
          </div>
          <AccountsTable
            accounts={accounts}
            onReclaim={handleReclaim}
            isLoading={isReclaiming}
          />
        </div>
      </main>
    </div>
  );
}
