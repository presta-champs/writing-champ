"use client";

import { useState } from "react";
import { Wifi, WifiOff, Loader2, CheckCircle, XCircle } from "lucide-react";

type TestResult = {
  status: "connected" | "error";
  tools?: number;
  prompts?: number;
  resources?: number;
  message?: string;
};

export function McpConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function testConnection() {
    setTesting(true);
    setResult(null);

    try {
      const res = await fetch("/api/mcp/test", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Could not reach the app server" });
    }

    setTesting(false);
  }

  return (
    <section
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wifi size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Connection Test
          </h2>
        </div>
        <button
          onClick={testConnection}
          disabled={testing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          Test Connection
        </button>
      </div>

      {result && (
        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--background)",
            border: `1px solid ${result.status === "connected" ? "var(--success)" : "var(--danger)"}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {result.status === "connected" ? (
              <CheckCircle size={16} style={{ color: "var(--success)" }} />
            ) : (
              <XCircle size={16} style={{ color: "var(--danger)" }} />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: result.status === "connected" ? "var(--success)" : "var(--danger)" }}
            >
              {result.status === "connected" ? "Connected" : "Connection Failed"}
            </span>
          </div>

          {result.status === "connected" && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {result.tools}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tools</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {result.prompts}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Prompts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {result.resources}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Resources</p>
              </div>
            </div>
          )}

          {result.message && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              {result.message}
            </p>
          )}
        </div>
      )}

      {!result && !testing && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Click "Test Connection" to verify the MCP server is reachable and list available tools.
        </p>
      )}
    </section>
  );
}
