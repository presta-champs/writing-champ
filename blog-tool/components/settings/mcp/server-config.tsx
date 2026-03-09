"use client";

import { useState, useEffect } from "react";
import { Server, Loader2, Check, Copy, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function McpServerConfig({
  orgId,
  isAdmin,
}: {
  orgId: string;
  isAdmin: boolean;
}) {
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpPort, setMcpPort] = useState("3100");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("mcp_server_url, mcp_port, mcp_api_key")
        .eq("id", orgId)
        .single();

      if (data) {
        setMcpUrl(data.mcp_server_url || "http://localhost");
        setMcpPort(data.mcp_port?.toString() || "3100");
        setApiKey(data.mcp_api_key || "");
      }
    }
    load();
  }, [orgId]);

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({
        mcp_server_url: mcpUrl,
        mcp_port: parseInt(mcpPort, 10),
      })
      .eq("id", orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateApiKey() {
    if (!isAdmin) return;
    setGenerating(true);
    const newKey = `wc_${crypto.randomUUID().replace(/-/g, "")}`;
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({ mcp_api_key: newKey })
      .eq("id", orgId);
    setApiKey(newKey);
    setGenerating(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const fullUrl = `${mcpUrl}:${mcpPort}/mcp`;

  return (
    <div className="space-y-4">
      {/* Server URL */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Server URL
          </label>
          <input
            type="text"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
            disabled={!isAdmin}
            placeholder="http://localhost"
            className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Port
          </label>
          <input
            type="text"
            value={mcpPort}
            onChange={(e) => setMcpPort(e.target.value)}
            disabled={!isAdmin}
            placeholder="3100"
            className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* MCP Endpoint */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          MCP Endpoint
        </label>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--accent)" }}
          >
            {fullUrl}
          </code>
          <button
            onClick={() => copyToClipboard(fullUrl)}
            className="p-2 rounded-lg transition hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
            title="Copy endpoint URL"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          API Key (for external clients)
        </label>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {apiKey ? (showApiKey ? apiKey : "wc_" + "•".repeat(28)) : "No API key generated"}
          </div>
          {apiKey && (
            <>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-2 rounded-lg transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={() => copyToClipboard(apiKey)}
                className="p-2 rounded-lg transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                <Copy size={14} />
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={generateApiKey}
              disabled={generating}
              className="px-3 py-2 rounded-lg text-xs font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--surface-warm)", color: "var(--foreground)" }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : apiKey ? "Regenerate" : "Generate"}
            </button>
          )}
        </div>
      </div>

      {/* Save */}
      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Server size={14} />}
          {saved ? "Saved" : "Save Configuration"}
        </button>
      )}
    </div>
  );
}
