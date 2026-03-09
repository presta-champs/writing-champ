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
        const isActive =
          item.href === "/dashboard/settings"
            ? pathname === "/dashboard/settings"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            style={{
              background: isActive ? "var(--surface-warm)" : "transparent",
              color: isActive ? "var(--foreground)" : "var(--text-muted)",
            }}
          >
            <item.icon size={15} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
