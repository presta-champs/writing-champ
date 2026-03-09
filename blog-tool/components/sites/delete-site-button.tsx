"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteSite } from "@/app/actions/sites";

export function DeleteSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${siteName}"? This cannot be undone.`)) return;
    setPending(true);
    const result = await deleteSite(siteId);
    if (!result.success) {
      alert(result.error || "Failed to delete site");
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-sm hover:opacity-80 disabled:opacity-50"
      style={{ color: "var(--danger, #dc2626)" }}
      title="Delete site"
    >
      <Trash2 size={15} />
    </button>
  );
}
