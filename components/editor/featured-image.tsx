"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { ImagePickerModal } from "./image-picker-modal";

type Props = {
  currentUrl?: string;
  onUrlChange: (url: string | null) => void;
  primaryKeyword?: string;
};

export function FeaturedImage({ currentUrl, onUrlChange, primaryKeyword }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          Featured Image
        </h3>

        {currentUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <img src={currentUrl} alt="Featured" className="w-full max-h-48 object-cover" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <ImagePlus size={13} /> Change
              </button>
              <button
                onClick={() => onUrlChange(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80"
                style={{ color: "var(--danger)" }}
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed transition hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <ImagePlus size={24} />
            <span className="text-sm">Choose Featured Image</span>
          </button>
        )}
      </div>

      <ImagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => {
          onUrlChange(url);
          setPickerOpen(false);
        }}
        initialQuery={primaryKeyword || ""}
        primaryKeyword={primaryKeyword}
      />
    </>
  );
}
