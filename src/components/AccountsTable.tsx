"use client";

import { useState } from "react";
import {
    Check,
    Shield,
    Clock,
    Wallet,
    ExternalLink,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface Account {
    address: string;
    balance: number;
    rentExemptMin: number;
    lastActivity: string;
    status: string;
    detectedAt: string;
}

interface AccountsTableProps {
    accounts: Account[];
    onReclaim: (address: string) => void;
    isLoading?: boolean;
}

const statusConfig: Record<
    string,
    { label: string; className: string; icon: React.ReactNode }
> = {
    ELIGIBLE: {
        label: "Eligible",
        className: "status-eligible",
        icon: <Check size={12} />,
    },
    PROTECTED: {
        label: "Protected",
        className: "status-protected",
        icon: <Shield size={12} />,
    },
    ACTIVE: {
        label: "Active",
        className: "status-active",
        icon: <Clock size={12} />,
    },
    RECLAIMED: {
        label: "Reclaimed",
        className: "status-reclaimed",
        icon: <Wallet size={12} />,
    },
    WHITELISTED: {
        label: "Whitelisted",
        className: "status-whitelisted",
        icon: <Shield size={12} />,
    },
};

function truncateAddress(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

export function AccountsTable({
    accounts,
    onReclaim,
    isLoading = false,
}: AccountsTableProps) {
    const [sortField, setSortField] = useState<keyof Account>("lastActivity");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const sortedAccounts = [...accounts].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === "string" && typeof bVal === "string") {
            return sortDirection === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }
        return 0;
    });

    const handleSort = (field: keyof Account) => {
        if (field === sortField) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    const SortIcon = ({ field }: { field: keyof Account }) => {
        if (field !== sortField) return null;
        return sortDirection === "asc" ? (
            <ChevronUp size={14} className="text-zinc-400" />
        ) : (
            <ChevronDown size={14} className="text-zinc-400" />
        );
    };

    if (accounts.length === 0) {
        return (
            <div className="card p-8 text-center">
                <Wallet size={40} className="mx-auto text-zinc-600" />
                <p className="mt-4 text-sm text-zinc-500">No sponsored accounts found</p>
                <p className="mt-1 text-xs text-zinc-600">
                    Run a scan to discover accounts
                </p>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="table-header text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                            <th
                                className="cursor-pointer px-4 py-3 hover:text-zinc-300"
                                onClick={() => handleSort("address")}
                            >
                                <div className="flex items-center gap-1">
                                    Address
                                    <SortIcon field="address" />
                                </div>
                            </th>
                            <th
                                className="cursor-pointer px-4 py-3 hover:text-zinc-300"
                                onClick={() => handleSort("balance")}
                            >
                                <div className="flex items-center gap-1">
                                    Balance
                                    <SortIcon field="balance" />
                                </div>
                            </th>
                            <th
                                className="cursor-pointer px-4 py-3 hover:text-zinc-300"
                                onClick={() => handleSort("lastActivity")}
                            >
                                <div className="flex items-center gap-1">
                                    Last Activity
                                    <SortIcon field="lastActivity" />
                                </div>
                            </th>
                            <th
                                className="cursor-pointer px-4 py-3 hover:text-zinc-300"
                                onClick={() => handleSort("status")}
                            >
                                <div className="flex items-center gap-1">
                                    Status
                                    <SortIcon field="status" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAccounts.map((account) => {
                            const status = statusConfig[account.status] || statusConfig.ACTIVE;
                            const isEligible = account.status === "ELIGIBLE";

                            return (
                                <tr key={account.address} className="table-row">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <code className="font-mono text-sm text-zinc-300">
                                                {truncateAddress(account.address)}
                                            </code>
                                            <a
                                                href={`https://explorer.solana.com/address/${account.address}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-zinc-500 hover:text-zinc-300"
                                                aria-label="View on Solana Explorer"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-sm text-zinc-300">
                                            {account.balance.toFixed(6)} SOL
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-zinc-400">
                                            {formatDate(account.lastActivity)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                                        >
                                            {status.icon}
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isEligible ? (
                                            <button
                                                onClick={() => onReclaim(account.address)}
                                                disabled={isLoading}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Reclaim
                                            </button>
                                        ) : (
                                            <span className="text-xs text-zinc-600">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
