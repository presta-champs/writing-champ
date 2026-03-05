import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { redirect } from "next/navigation";
import { getApiKeyStatus } from "@/app/actions/settings";
import { OrgNameForm } from "@/components/settings/org-name-form";
import { ApiKeysForm } from "@/components/settings/api-keys-form";
import { Key, Building2 } from "lucide-react";

export default async function SettingsPage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) redirect("/login");

  const apiKeys = await getApiKeyStatus();
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

      {/* Organization section */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Workspace
          </h2>
        </div>

        <OrgNameForm currentName={org.name} isAdmin={isAdmin} />

        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Plan</span>
            <span
              className="text-sm font-medium px-2.5 py-0.5 rounded-full capitalize"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              {org.plan || "starter"}
            </span>
          </div>
        </div>
      </section>

      {/* API Keys section */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Key size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            API Keys
          </h2>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Keys are encrypted at rest. Only admins can view or change them.
        </p>

        <ApiKeysForm keys={apiKeys} isAdmin={isAdmin} />
      </section>

      {/* Account info */}
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Email</span>
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {user.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Name</span>
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {user.name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Role</span>
            <span
              className="text-sm font-medium px-2.5 py-0.5 rounded-full capitalize"
              style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
            >
              {org.role}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
