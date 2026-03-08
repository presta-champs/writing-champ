"use client";

import { useState } from "react";
import {
  testMcpConnection,
  saveMcpConnection,
  disconnectMcp,
  syncContentIndex,
} from "@/app/actions/mcp";
import {
  Plug,
  Unplug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";

type McpConnectionProps = {
  websiteId: string;
  platformType: string;
  currentUrl: string | null;
  currentStatus: "connected" | "error" | "unconfigured";
  lastSynced: string | null;
  isAdmin: boolean;
};

const PLATFORM_HELP: Record<string, { label: string; urlPlaceholder: string; tokenHelp: string }> = {
  wordpress: {
    label: "WordPress",
    urlPlaceholder: "https://yoursite.com",
    tokenHelp: "Use a WordPress Application Password. Go to Users → Profile → Application Passwords in your WordPress admin.",
  },
  prestashop: {
    label: "PrestaShop",
    urlPlaceholder: "https://yourshop.com",
    tokenHelp: "Use a PrestaShop webservice API key. Go to Advanced Parameters → Webservice in your PrestaShop admin.",
  },
  custom: {
    label: "Custom CMS",
    urlPlaceholder: "https://api.yoursite.com",
    tokenHelp: "Provide a Bearer token for your custom API endpoint.",
  },
};

export function McpConnection({
  websiteId,
  platformType,
  currentUrl,
  currentStatus,
  lastSynced,
  isAdmin,
}: McpConnectionProps) {
  const [serverUrl, setServerUrl] = useState(currentUrl || "");
  const [authToken, setAuthToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(currentStatus);

  const platform = PLATFORM_HELP[platformType] || PLATFORM_HELP.custom;
  const isConnected = status === "connected";

  async function handleTest() {
    if (!serverUrl.trim() || !authToken.trim()) return;
    setTesting(true);
    setTestResult(null);
    const result = await testMcpConnection(websiteId, serverUrl.trim(), authToken.trim());
    setTestResult(result);
    setTesting(false);
  }

  async function handleSave() {
    if (!serverUrl.trim() || !authToken.trim()) return;
    setSaving(true);
    setMessage("");
    const result = await saveMcpConnection(websiteId, serverUrl.trim(), authToken.trim());
    if (result.success) {
      setMessage("CMS connection saved.");
      setStatus("connected");
      setAuthToken("");
    } else {
      setMessage(result.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setMessage("");
    const result = await disconnectMcp(websiteId);
    if (result.success) {
      setStatus("unconfigured");
      setServerUrl("");
      setAuthToken("");
      setTestResult(null);
      setMessage("CMS disconnected.");
    } else {
      setMessage(result.error || "Failed to disconnect.");
    }
    setDisconnecting(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncContentIndex(websiteId);
    if (result.success) {
      setSyncResult(`Synced ${result.synced} pages from ${platform.label}.`);
    } else {
      setSyncResult(result.error || "Sync failed.");
    }
    setSyncing(false);
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plug size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            CMS Connection
          </h3>
          <StatusBadge status={status} />
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || !isAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              {syncing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {syncing ? "Syncing..." : "Sync Content Index"}
            </button>
          </div>
        )}
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Connect to your {platform.label} site to publish articles directly and sync your content index for internal linking.
      </p>

      {/* Connected state */}
      {isConnected && (
        <div className="space-y-3">
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {serverUrl || currentUrl}
                  </span>
                  <a
                    href={serverUrl || currentUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-50 hover:opacity-100"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                {lastSynced && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Last synced: {new Date(lastSynced).toLocaleString()}
                  </p>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--danger)" }}
                >
                  {disconnecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Unplug size={14} />
                  )}
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {syncResult && (
            <p
              className="text-sm"
              style={{
                color: syncResult.includes("failed") || syncResult.includes("error")
                  ? "var(--danger)"
                  : "var(--success)",
              }}
            >
              {syncResult}
            </p>
          )}
        </div>
      )}

      {/* Setup form */}
      {!isConnected && isAdmin && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {platform.label} URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={platform.urlPlaceholder}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              API Token / Application Password
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Paste your API token here"
                className="w-full rounded-lg px-3 py-2 pr-10 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100"
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              {platform.tokenHelp}
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className="rounded-lg p-3 text-sm flex items-start gap-2"
              style={{
                background: testResult.success ? "var(--success-light)" : "var(--danger-light)",
                color: testResult.success ? "var(--success)" : "var(--danger)",
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
              <div>
                <p>{testResult.message}</p>
              </div>
            </div>
          )}

          {message && (
            <p
              className="text-sm"
              style={{
                color: message.includes("Failed") || message.includes("error")
                  ? "var(--danger)"
                  : "var(--success)",
              }}
            >
              {message}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !serverUrl.trim() || !authToken.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plug size={14} />
              )}
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !serverUrl.trim() || !authToken.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {saving ? "Saving..." : "Save & Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Non-admin view for unconfigured */}
      {!isConnected && !isAdmin && (
        <div
          className="rounded-lg p-4 text-center"
          style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
        >
          <AlertCircle size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            CMS connection not configured. Ask an admin to set it up.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    connected: { label: "Connected", color: "var(--success)", bg: "var(--success-light)" },
    error: { label: "Error", color: "var(--danger)", bg: "var(--danger-light)" },
    unconfigured: { label: "Not Connected", color: "var(--text-muted)", bg: "var(--surface-warm)" },
  }[status] || { label: status, color: "var(--text-muted)", bg: "var(--surface-warm)" };

  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: config.color, background: config.bg }}
    >
      {config.label}
    </span>
  );
}
