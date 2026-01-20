"use client";

import { LucideIcon } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    trend?: {
        value: string;
        positive: boolean;
    };
    variant?: "default" | "success" | "warning" | "info";
}

const variantStyles = {
    default: {
        iconBg: "bg-zinc-800",
        iconColor: "text-zinc-400",
    },
    success: {
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
    },
    warning: {
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
    },
    info: {
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
    },
};

export function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    variant = "default",
}: StatsCardProps) {
    const styles = variantStyles[variant];

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-400">{title}</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
                    )}
                    {trend && (
                        <p
                            className={`mt-2 text-xs font-medium ${trend.positive ? "text-emerald-500" : "text-red-500"
                                }`}
                        >
                            {trend.positive ? "+" : "-"}{trend.value}
                        </p>
                    )}
                </div>
                <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${styles.iconBg}`}
                >
                    <Icon size={20} className={styles.iconColor} />
                </div>
            </div>
        </div>
    );
}
