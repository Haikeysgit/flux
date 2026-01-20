"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, ScrollText, Settings, Zap } from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/audit", label: "Audit Log", icon: <ScrollText size={18} /> },
];

interface HeaderProps {
    isMockMode?: boolean;
}

export function Header({ isMockMode = true }: HeaderProps) {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-700">
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-zinc-100">Flux</h1>
                            <p className="text-xs text-zinc-500">Kora Rent Guardian</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                                            ? "bg-zinc-800 text-zinc-100"
                                            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                                        }`}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Status indicators */}
                    <div className="flex items-center gap-4">
                        {isMockMode && (
                            <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1">
                                <Activity size={14} className="text-amber-500" />
                                <span className="text-xs font-medium text-amber-500">Mock Mode</span>
                            </div>
                        )}
                        <button
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                            aria-label="Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
