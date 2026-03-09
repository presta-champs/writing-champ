import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { redirect } from "next/navigation";
import { getTeamMembers, getActivityLog } from "@/app/actions/team";
import { SettingsNav } from "@/components/settings/settings-nav";
import { MemberList } from "@/components/settings/team/member-list";
import { InviteForm } from "@/components/settings/team/invite-form";
import { ActivityLog } from "@/components/settings/team/activity-log";
import { Users, Activity } from "lucide-react";

export default async function TeamPage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) redirect("/login");

  const isAdmin = org.role === "admin";
  const members = await getTeamMembers();

  // Only admins see the activity log
  const activityData = isAdmin
    ? await getActivityLog(50, 0)
    : { events: [], total: 0 };

  return (
    <div className="max-w-2xl w-full space-y-8">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Settings
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          Manage your workspace and API integrations.
        </p>
      </div>

      <SettingsNav />

      {/* Team Members */}
      <section
        className="rounded-xl p-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Users size={18} style={{ color: "var(--accent)" }} />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Team Members
          </h2>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          {members.length} member{members.length !== 1 ? "s" : ""} in this
          workspace.
          {!isAdmin &&
            " Contact an admin to manage team membership."}
        </p>

        <MemberList
          members={members}
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      </section>

      {/* Invite (admin only) */}
      {isAdmin && (
        <section
          className="rounded-xl p-6"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            Add a Team Member
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            The user must already have a WritingChamps account. Enter their
            email and choose a role.
          </p>

          <InviteForm />
        </section>
      )}

      {/* Activity Log (admin only) */}
      {isAdmin && (
        <section
          className="rounded-xl p-6"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} style={{ color: "var(--accent)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Activity Log
            </h2>
          </div>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Recent usage events across the workspace.
          </p>

          <ActivityLog
            initialEvents={activityData.events}
            initialTotal={activityData.total}
          />
        </section>
      )}
    </div>
  );
}
