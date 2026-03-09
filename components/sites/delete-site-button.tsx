"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function DeleteSiteButton({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("websites").delete().eq("id", siteId);
    if (!error) {
      router.refresh();
    }
    setDeleting(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--danger)" }}>
          Delete {siteName}?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ background: "var(--danger)", color: "#fff" }}
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 rounded text-xs"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1.5 rounded-lg transition hover:opacity-80"
      style={{ color: "var(--danger)" }}
    >
      <Trash2 size={14} />
    </button>
  );
}
