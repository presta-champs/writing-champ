"use client";

import { useState } from "react";
import { Copy, Check, Monitor } from "lucide-react";

export function McpClaudeDesktop() {
  const [copied, setCopied] = useState(false);

  const configSnippet = JSON.stringify(
    {
      "writing-champ": {
        command: "node",
        args: ["--env-file=.env", "--import", "tsx/esm", "stdio.ts"],
        cwd: "D:\\Downloads\\writing-champ-master\\writing-champ-master\\mcp-server",
      },
    },
    null,
    2
  );

  function copyConfig() {
    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Monitor size={18} style={{ color: "var(--accent)" }} />
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Claude Desktop Setup
        </h2>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Add this to your Claude Desktop config file to connect WritingChamp as an MCP server.
      </p>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              claude_desktop_config.json
            </label>
            <button
              onClick={copyConfig}
              className="inline-flex items-center gap-1 text-xs transition hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre
            className="rounded-lg p-3 text-xs font-mono overflow-x-auto"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {configSnippet}
          </pre>
        </div>

        <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
          <p><strong>Steps:</strong></p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Start the MCP server: <code className="px-1 py-0.5 rounded" style={{ background: "var(--background)" }}>cd mcp-server && npm run dev</code></li>
            <li>Open Claude Desktop Settings → Developer → Edit Config</li>
            <li>Add the snippet above inside <code className="px-1 py-0.5 rounded" style={{ background: "var(--background)" }}>"mcpServers"</code></li>
            <li>Restart Claude Desktop</li>
          </ol>
        </div>

        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
        >
          <strong>For remote/production use:</strong> Replace <code>localhost:3100</code> with your deployed server URL and add an API key for authentication.
        </div>
      </div>
    </section>
  );
}
