"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCircle, XCircle, FileText } from "lucide-react";
import {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/app/actions/notifications";
import { useRouter } from "next/navigation";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "approval_approved":
      return <CheckCircle size={16} style={{ color: "var(--success)" }} />;
    case "approval_rejected":
      return <XCircle size={16} style={{ color: "var(--danger)" }} />;
    case "approval_submitted":
    default:
      return <FileText size={16} style={{ color: "var(--accent)" }} />;
  }
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function togglePanel() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const data = await getNotifications(15);
    setNotifications(data);
    setLoading(false);
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function handleClickNotification(notification: Notification) {
    if (!notification.read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (notification.article_id) {
      router.push(`/dashboard/articles/${notification.article_id}`);
    }
  }

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={togglePanel}
        className="relative flex items-center justify-center rounded-lg p-2 hover:opacity-80 transition"
        style={{ color: "var(--foreground)", background: "transparent" }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: "var(--danger)",
              color: "#fff",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              fontSize: "11px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-lg shadow-lg overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            width: "360px",
            maxHeight: "420px",
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium hover:opacity-80 transition"
                style={{ color: "var(--accent)", background: "transparent" }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", maxHeight: "360px" }}>
            {loading ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:opacity-80 transition"
                  style={{
                    background: n.read ? "transparent" : "var(--accent-muted, rgba(99,102,241,0.06))",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{
                        color: n.read ? "var(--text-muted)" : "var(--foreground)",
                      }}
                    >
                      {n.title}
                    </div>
                    {n.message && (
                      <div
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {n.message}
                      </div>
                    )}
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)", opacity: 0.7 }}
                    >
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <div
                      className="mt-2 flex-shrink-0 rounded-full"
                      style={{
                        width: "8px",
                        height: "8px",
                        background: "var(--accent)",
                      }}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
