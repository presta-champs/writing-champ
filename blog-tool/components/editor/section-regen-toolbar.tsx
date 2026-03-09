"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import type { Editor } from "@tiptap/react";

type SectionRegenNudge =
  | "shorter"
  | "longer"
  | "more formal"
  | "more casual"
  | "simpler"
  | "more detailed";

const NUDGE_OPTIONS: { value: SectionRegenNudge; label: string }[] = [
  { value: "shorter", label: "Make shorter" },
  { value: "longer", label: "Make longer" },
  { value: "more formal", label: "More formal" },
  { value: "more casual", label: "More casual" },
  { value: "simpler", label: "Simplify" },
  { value: "more detailed", label: "More detail" },
];

type Props = {
  editor: Editor;
  articleId: string;
  /** Called after the regenerated HTML replaces the selection */
  onContentChange?: (fullHtml: string) => void;
};

/**
 * Floating toolbar that appears when the user selects a block-level section
 * (heading + following content, or a paragraph). Provides "Regenerate" with
 * optional nudge directions.
 */
export function SectionRegenToolbar({ editor, articleId, onContentChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [regenerating, setRegenerating] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [selectedNudge, setSelectedNudge] = useState<SectionRegenNudge | undefined>();
  const [error, setError] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);

  // Track selection changes to show/hide toolbar
  useEffect(() => {
    if (!editor) return;

    function handleSelectionUpdate() {
      const { state } = editor;
      const { selection } = state;
      const { from, to } = selection;

      // Need a non-empty selection with actual content
      if (from === to || selection.empty) {
        if (!regenerating) {
          setVisible(false);
        }
        return;
      }

      // Get the selected text length to ensure it's a meaningful section
      const selectedText = state.doc.textBetween(from, to, " ");
      if (selectedText.trim().length < 20) {
        if (!regenerating) {
          setVisible(false);
        }
        return;
      }

      // Position the toolbar above the selection
      const coords = editor.view.coordsAtPos(from);
      const editorRect = editor.view.dom.getBoundingClientRect();

      setPosition({
        top: coords.top - editorRect.top - 48,
        left: Math.max(0, coords.left - editorRect.left),
      });
      setVisible(true);
      setError(null);
    }

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, regenerating]);

  // Close nudge dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (nudgeRef.current && !nudgeRef.current.contains(e.target as Node)) {
        setNudgeOpen(false);
      }
    }
    if (nudgeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [nudgeOpen]);

  const handleRegenerate = useCallback(
    async (nudge?: SectionRegenNudge) => {
      const { state } = editor;
      const { selection } = state;
      const { from, to } = selection;

      if (from === to) return;

      // Get the HTML of the selected range using ProseMirror serializer
      const slice = state.doc.slice(from, to);
      const tempDiv = document.createElement("div");
      const { DOMSerializer } = await import("@tiptap/pm/model");
      const serializer = DOMSerializer.fromSchema(editor.schema);
      const fragment = serializer.serializeFragment(slice.content);
      tempDiv.appendChild(fragment);
      const sectionHtml = tempDiv.innerHTML;

      if (!sectionHtml.trim()) return;

      // Capture the original HTML before we modify anything, so we can do
      // a string-level replacement at the end
      const originalFullHtml = editor.getHTML();

      setRegenerating(true);
      setError(null);
      setNudgeOpen(false);

      try {
        const response = await fetch(`/api/articles/${articleId}/regen-section`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionHtml,
            nudge: nudge || selectedNudge,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed (${response.status})`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read the full streamed response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }

        // Strip the cost marker appended by generatorToStream
        const finalHtml = accumulated
          .replace(/\n?<!--GENERATION_COST:[\s\S]*?-->/, "")
          .trim();

        if (!finalHtml) {
          throw new Error("Empty response from model");
        }

        // Replace the selected section in the full HTML.
        // We use the captured sectionHtml from serialization to find
        // the matching region in the editor's HTML output.
        // Because both come from the same Tiptap serializer, they match.
        const idx = originalFullHtml.indexOf(sectionHtml);
        let newFullHtml: string;
        if (idx !== -1) {
          // String-level replacement — most reliable
          newFullHtml =
            originalFullHtml.slice(0, idx) +
            finalHtml +
            originalFullHtml.slice(idx + sectionHtml.length);
        } else {
          // Fallback: use ProseMirror position-based replacement
          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContentAt(from, finalHtml, {
              parseOptions: { preserveWhitespace: false },
            })
            .run();
          newFullHtml = editor.getHTML();
        }

        // Set the full content atomically
        editor.commands.setContent(newFullHtml, { emitUpdate: false });

        if (onContentChange) {
          onContentChange(newFullHtml);
        }

        setVisible(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Regeneration failed";
        setError(message);
      } finally {
        setRegenerating(false);
      }
    },
    [editor, articleId, selectedNudge, onContentChange]
  );

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        pointerEvents: "auto",
      }}
    >
      {/* Regenerate button */}
      <button
        onClick={() => handleRegenerate()}
        disabled={regenerating}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition hover:opacity-80"
        style={{
          background: "var(--accent)",
          color: "var(--accent-text)",
          opacity: regenerating ? 0.7 : 1,
          cursor: regenerating ? "wait" : "pointer",
        }}
      >
        <RefreshCw
          size={12}
          className={regenerating ? "animate-spin" : ""}
        />
        {regenerating ? "Regenerating..." : "Regenerate"}
      </button>

      {/* Nudge dropdown */}
      <div className="relative" ref={nudgeRef}>
        <button
          onClick={() => setNudgeOpen((prev) => !prev)}
          disabled={regenerating}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition hover:opacity-80"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            background: "var(--surface-warm)",
            cursor: regenerating ? "wait" : "pointer",
          }}
        >
          {selectedNudge
            ? NUDGE_OPTIONS.find((n) => n.value === selectedNudge)?.label
            : "Adjust"}
          <ChevronDown size={10} />
        </button>

        {nudgeOpen && (
          <div
            className="absolute left-0 bottom-full mb-1 w-36 rounded-lg py-1 shadow-lg z-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {/* "No nudge" option */}
            <button
              onClick={() => {
                setSelectedNudge(undefined);
                setNudgeOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs transition"
              style={{
                color: !selectedNudge ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: !selectedNudge ? 600 : 400,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surface-warm)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              Default
            </button>
            {NUDGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSelectedNudge(opt.value);
                  setNudgeOpen(false);
                  // Immediately trigger regeneration with this nudge
                  handleRegenerate(opt.value);
                }}
                className="w-full text-left px-3 py-1.5 text-xs transition"
                style={{
                  color:
                    selectedNudge === opt.value
                      ? "var(--accent)"
                      : "var(--foreground)",
                  fontWeight: selectedNudge === opt.value ? 600 : 400,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-warm)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <span
          className="text-[10px] max-w-[200px] truncate"
          style={{ color: "var(--danger)" }}
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}
