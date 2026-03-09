"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/settings", label: "General", icon: Settings },
  { href: "/dashboard/settings/team", label: "Team", icon: Users },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 mb-6">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            style={{
              background: active ? "var(--accent-light)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            <Icon size={14} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
