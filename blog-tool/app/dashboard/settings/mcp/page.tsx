import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings/settings-nav";
import { McpServerConfig } from "@/components/settings/mcp/server-config";
import { McpToolsList } from "@/components/settings/mcp/tools-list";
import { McpConnectionTest } from "@/components/settings/mcp/connection-test";
import { McpClaudeDesktop } from "@/components/settings/mcp/claude-desktop";
import { Plug } from "lucide-react";

export default async function McpSettingsPage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) redirect("/login");

  const isAdmin = org.role === "admin";

  return (
    <div className="max-w-2xl w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          Manage your workspace and API integrations.
        </p>
      </div>

      <SettingsNav />

      {/* MCP Server Status */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Plug size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            MCP Server
          </h2>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Connect Claude Desktop, your sites, and other MCP clients to WritingChamp.
        </p>

        <McpServerConfig orgId={org.id} isAdmin={isAdmin} />
      </section>

      {/* Connection Test */}
      <McpConnectionTest />

      {/* Claude Desktop Setup */}
      <McpClaudeDesktop />

      {/* Available Tools */}
      <McpToolsList />
    </div>
  );
}
