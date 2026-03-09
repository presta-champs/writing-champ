"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Search, Sparkles, X } from "lucide-react";
import { ImagePickerModal } from "./image-picker-modal";

type Marker = {
  fullMatch: string;
  prompt: string;
  index: number;
};

type Props = {
  html: string;
  onChange: (newHtml: string) => void;
  onFeaturedImageSet?: (url: string) => void;
  primaryKeyword?: string;
};

function extractMarkers(html: string): Marker[] {
  const regex = /\[IMAGE:\s*([^\]]+)\]/gi;
  const markers: Marker[] = [];
  let match;
  let idx = 0;
  while ((match = regex.exec(html)) !== null) {
    markers.push({
      fullMatch: match[0],
      prompt: match[1].trim(),
      index: idx++,
    });
  }
  return markers;
}

export function ImageMarkers({ html, onChange, onFeaturedImageSet, primaryKeyword }: Props) {
  const markers = useMemo(() => extractMarkers(html), [html]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeMarker, setActiveMarker] = useState<Marker | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  if (markers.length === 0) return null;

  const visibleMarkers = markers.filter((m) => !dismissed.has(m.index));
  if (visibleMarkers.length === 0) return null;

  function handleOpenPicker(marker: Marker) {
    setActiveMarker(marker);
    setPickerOpen(true);
  }

  function handleSelect(url: string, alt: string) {
    if (!activeMarker) return;
    const imgTag = `<img src="${url}" alt="${alt.replace(/"/g, '&quot;')}" />`;
    const newHtml = html.replace(activeMarker.fullMatch, imgTag);
    onChange(newHtml);

    // First marker = featured image candidate
    if (activeMarker.index === 0 && onFeaturedImageSet) {
      onFeaturedImageSet(url);
    }

    setPickerOpen(false);
    setActiveMarker(null);
  }

  function handleDismiss(marker: Marker) {
    // Remove the marker text entirely
    const newHtml = html.replace(marker.fullMatch, "");
    onChange(newHtml);
    setDismissed((prev) => new Set(prev).add(marker.index));
  }

  return (
    <>
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <ImagePlus size={16} style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Image Placeholders
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            {visibleMarkers.length} remaining
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Replace placeholders with stock photos, AI-generated images, or your own URLs.
        </p>

        {visibleMarkers.map((marker) => (
          <div
            key={marker.index}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {marker.index === 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    Featured
                  </span>
                )}
                <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                  {marker.prompt}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleOpenPicker(marker)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                <Search size={12} /> Find Image
              </button>
              <button
                onClick={() => handleDismiss(marker)}
                className="p-1.5 rounded transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                title="Remove placeholder"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ImagePickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setActiveMarker(null); }}
        onSelect={handleSelect}
        initialQuery={activeMarker?.prompt || ""}
        primaryKeyword={primaryKeyword}
      />
    </>
  );
}
