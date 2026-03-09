"use client";

import { useState, useRef, useCallback } from "react";
import { analyzePersonaVoice } from "@/app/actions/personas";
import { Upload, Trash2, Sparkles, Loader2, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import type { PersonaWritingSample } from "@/types";

type Props = {
  personaId: string;
  samples: PersonaWritingSample[];
  voiceSummary: string | null | undefined;
};

const ACCEPTED_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_EXTENSIONS = [".txt", ".md", ".doc", ".docx", ".pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase() || "";
  return ext;
}

function isValidFile(file: File): string | null {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type. Please upload ${ACCEPTED_EXTENSIONS.join(", ")} files.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large (${formatFileSize(file.size)}). Maximum size is 5 MB.`;
  }
  return null;
}

export function WritingSamples({ personaId, samples, voiceSummary }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const clearMessage = useCallback(() => {
    setTimeout(() => setMessage(null), 5000);
  }, []);

  function showMessage(text: string, type: "success" | "error") {
    setMessage({ text, type });
    clearMessage();
  }

  async function uploadFile(file: File) {
    const validationError = isValidFile(file);
    if (validationError) {
      showMessage(validationError, "error");
      return;
    }

    setIsUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("personaId", personaId);
      const res = await fetch("/api/writing-samples", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok || result.error) {
        showMessage(result.error || "Upload failed.", "error");
      } else {
        showMessage(`"${file.name}" uploaded successfully.`, "success");
        window.location.reload();
      }
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Something went wrong during upload. Please try again.",
        "error"
      );
    } finally {
      setIsUploading(false);
      setPendingFiles([]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPendingFiles([file]);
    uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPendingFiles([file]);
    uploadFile(file);
  }

  async function handleDelete(sampleId: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setDeletingIds((prev) => new Set(prev).add(sampleId));
    try {
      const res = await fetch(`/api/writing-samples/${sampleId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || result.error) {
        showMessage(result.error || "Delete failed.", "error");
      } else {
        showMessage(`"${filename}" deleted.`, "success");
        window.location.reload();
      }
    } catch {
      showMessage("Could not delete the sample. Please try again.", "error");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(sampleId);
        return next;
      });
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setMessage(null);
    try {
      await analyzePersonaVoice(personaId);
      showMessage("Voice analysis complete. The persona voice summary has been updated.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Voice analysis could not be completed.";
      showMessage(msg, "error");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasExtractedText = samples.some((s) => s.extracted_text);

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
      >
        <h3
          className="text-sm font-semibold mb-1 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <FileText size={15} />
          Writing Samples
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Upload examples of content written in this persona's voice. We will analyze them to extract
          voice instructions automatically.
        </p>

        {/* Drag-and-drop zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileRef.current?.click()}
          className="relative rounded-lg p-6 text-center cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${isDragOver ? "var(--accent)" : "var(--border)"}`,
            background: isDragOver ? "var(--accent-light, rgba(0,0,0,0.02))" : "var(--surface)",
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Uploading{pendingFiles.length > 0 ? ` "${pendingFiles[0].name}"` : ""}...
              </p>
              {pendingFiles.length > 0 && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatFileSize(pendingFiles[0].size)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: isDragOver ? "var(--accent)" : "var(--surface-warm)",
                  color: isDragOver ? "var(--accent-text, #fff)" : "var(--text-muted)",
                }}
              >
                <Upload size={18} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {isDragOver ? "Drop file here" : "Drag and drop a file, or click to browse"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  TXT, DOCX, PDF up to 5 MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              background: message.type === "error" ? "var(--danger-light, #fef2f2)" : "var(--success-light, #f0fdf4)",
              color: message.type === "error" ? "var(--danger)" : "var(--success)",
            }}
          >
            {message.type === "error" ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto hover:opacity-70"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Sample list */}
      {samples.length > 0 ? (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {samples.length} sample{samples.length !== 1 ? "s" : ""} uploaded
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {samples.map((sample) => {
              const isDeleting = deletingIds.has(sample.id);
              return (
                <div
                  key={sample.id}
                  className="flex items-center justify-between px-4 py-3 transition-opacity"
                  style={{
                    background: "var(--surface)",
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "var(--surface-warm)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span
                        className="text-[10px] font-bold leading-none"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {getFileExtension(sample.filename)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm truncate"
                        style={{ color: "var(--text-secondary)" }}
                        title={sample.filename}
                      >
                        {sample.filename}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(sample.uploaded_at)}
                        {sample.extracted_text ? (
                          <span className="ml-2">
                            &middot; {sample.extracted_text.length.toLocaleString()} chars extracted
                          </span>
                        ) : (
                          <span
                            className="ml-2"
                            style={{ color: "var(--warning, var(--text-muted))" }}
                          >
                            &middot; No text extracted
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(sample.id, sample.filename)}
                    disabled={isDeleting}
                    className="ml-3 p-1.5 rounded-md hover:opacity-70 transition flex-shrink-0 disabled:opacity-30"
                    style={{ color: "var(--danger)" }}
                    title="Delete sample"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <FileText
            size={28}
            className="mx-auto mb-2"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Upload writing samples to train this persona's voice.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            The more samples you provide, the more accurate the voice analysis will be.
          </p>
        </div>
      )}

      {/* Analyze Voice button */}
      {samples.length > 0 && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !hasExtractedText}
          className="w-full px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          title={
            !hasExtractedText
              ? "At least one sample must have extracted text before analysis."
              : undefined
          }
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Analyzing writing style...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Analyze Voice</span>
            </>
          )}
        </button>
      )}

      {/* Voice summary display */}
      {voiceSummary && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--accent-light, var(--surface-warm))",
            border: "1px solid var(--border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-2 flex items-center gap-2"
            style={{ color: "var(--accent)" }}
          >
            <Sparkles size={14} />
            Voice Summary
          </h3>
          <p
            className="text-sm whitespace-pre-wrap leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {voiceSummary}
          </p>
        </div>
      )}
    </div>
  );
}
