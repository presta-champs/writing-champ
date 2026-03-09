"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setNotifications((data || []) as Notification[]);
    }
    load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markAllRead() {
    const supabase = createClient();
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="relative p-2 rounded-lg transition hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl shadow-lg z-50"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Notifications
            </p>
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="px-3 py-2 border-b last:border-b-0"
                style={{
                  borderColor: "var(--border)",
                  background: n.read ? "transparent" : "var(--accent-light)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--foreground)" }}>{n.message}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
