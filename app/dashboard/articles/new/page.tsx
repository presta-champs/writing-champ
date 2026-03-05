"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Download, Check, Save } from "lucide-react";
import { ArticleEditor } from "@/components/editor/article-editor";
import { KeywordResearchStep } from "@/components/pipeline/keyword-research-step";
import { SeoCheckPanel } from "@/components/pipeline/seo-check-panel";

type Website = { id: string; name: string; url: string; platform_type: string };
type Persona = { id: string; name: string; bio: string | null; badges?: string[]; usage_count?: number };
type ModelOption = { id: string; label: string; provider: string };

type Step = "site" | "persona" | "brief" | "keywords" | "generate" | "done";

const FORMATS = [
  { value: "how-to", label: "How-To Guide" },
  { value: "opinion", label: "Opinion / Commentary" },
  { value: "roundup", label: "Roundup / List" },
  { value: "explainer", label: "Explainer" },
  { value: "listicle", label: "Listicle" },
  { value: "tutorial", label: "Tutorial" },
  { value: "case-study", label: "Case Study" },
];

export default function NewArticlePage() {
  const [step, setStep] = useState<Step>("site");
  const [websites, setWebsites] = useState<Website[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [brief, setBrief] = useState({
    topic: "",
    format: "how-to",
    targetLength: 1500,
    model: "",
    notes: "",
    primaryKeyword: "",
    secondaryKeywords: "",
  });
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [articleId, setArticleId] = useState<string | null>(null);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  const supabase = createClient();

  // Load websites and available models on mount
  useEffect(() => {
    async function loadWebsites() {
      const { data } = await supabase.from("websites").select("id, name, url, platform_type");
      if (data) setWebsites(data);
    }
    async function loadModels() {
      try {
        const res = await fetch("/api/models");
        const { models } = await res.json();
        if (models?.length) {
          setAvailableModels(models);
          setBrief((prev) => ({ ...prev, model: prev.model || models[0].id }));
        }
      } catch { /* ignore */ }
    }
    loadWebsites();
    loadModels();
  }, []);

  // Load personas when website is selected
  useEffect(() => {
    if (!selectedWebsite) return;
    const websiteId = selectedWebsite.id;
    async function loadPersonas() {
      const { data: allPersonas } = await supabase
        .from("personas")
        .select("id, name, bio, badges")
        .eq("archived", false);

      if (allPersonas) {
        const { data: assignments } = await supabase
          .from("persona_website_assignments")
          .select("persona_id, usage_count")
          .eq("website_id", websiteId);

        const usageMap = new Map(
          (assignments || []).map((a) => [a.persona_id, a.usage_count])
        );

        const sorted = allPersonas
          .map((p) => ({ ...p, usage_count: usageMap.get(p.id) || 0 }))
          .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

        setPersonas(sorted);
      }
    }
    loadPersonas();
  }, [selectedWebsite]);

  async function handleGenerate(overrides?: { primaryKeyword?: string; secondaryKeywords?: string }) {
    if (!selectedWebsite || !selectedPersona) return;

    const pk = overrides?.primaryKeyword ?? brief.primaryKeyword;
    const sk = overrides?.secondaryKeywords ?? brief.secondaryKeywords;

    setIsGenerating(true);
    setGenerationError("");
    setGeneratedHtml("");
    setEditedHtml("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: selectedWebsite.id,
          personaId: selectedPersona.id,
          topic: brief.topic,
          format: brief.format,
          targetLength: brief.targetLength,
          model: brief.model || undefined,
          notes: brief.notes || undefined,
          primaryKeyword: pk || undefined,
          secondaryKeywords: sk
            ? sk.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setGeneratedHtml(fullText);
      }

      setEditedHtml(fullText);
      setStep("done");

      // Fetch the article ID and meta fields from the most recent draft
      const { data: recentArticle } = await supabase
        .from("articles")
        .select("id, meta_title, meta_description, body")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (recentArticle) {
        setArticleId(recentArticle.id);
        setMetaTitle(recentArticle.meta_title || "");
        setMetaDescription(recentArticle.meta_description || "");
        // Use the DB version (may have been revised for word count)
        if (recentArticle.body && recentArticle.body !== fullText) {
          setEditedHtml(recentArticle.body);
        }
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "An unexpected error occurred."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!articleId || !editedHtml) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const wordCount = editedHtml.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
      const { error } = await supabase
        .from("articles")
        .update({
          body: editedHtml,
          word_count: wordCount,
          meta_title: metaTitle || null,
          meta_description: metaDescription || null,
        })
        .eq("id", articleId);
      if (error) throw error;
      setSaveMessage("Saved.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch {
      setSaveMessage("Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExport(format: "html" | "markdown" | "plain") {
    if (!articleId) return;
    window.open(`/api/articles/${articleId}/export?format=${format}`, "_blank");
  }

  const stepOrder: Step[] = ["site", "persona", "brief", "keywords", "generate"];
  const currentIdx = step === "done" ? 5 : stepOrder.indexOf(step);

  return (
    <div className="max-w-4xl w-full">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:underline"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          New Article
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          Follow the steps to generate a new article.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepOrder.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
              style={
                step === s
                  ? { background: "var(--accent)", color: "var(--accent-text)" }
                  : currentIdx > i
                  ? { background: "var(--success-light)", color: "var(--success)" }
                  : { background: "var(--surface-warm)", color: "var(--text-muted)" }
              }
            >
              {currentIdx > i ? <Check size={16} /> : i + 1}
            </div>
            {i < stepOrder.length - 1 && (
              <div className="w-12 h-0.5" style={{ background: "var(--border)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Website */}
      {step === "site" && (
        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Select Website
          </h2>
          {websites.length === 0 ? (
            <div className="text-center py-8">
              <p className="mb-4" style={{ color: "var(--text-muted)" }}>
                No websites found. Create one first.
              </p>
              <Link
                href="/dashboard/sites/new"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Add Website
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {websites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => {
                    setSelectedWebsite(site);
                    setStep("persona");
                  }}
                  className="w-full text-left p-4 rounded-lg transition"
                  style={{
                    border: selectedWebsite?.id === site.id
                      ? "2px solid var(--accent)"
                      : "1px solid var(--border)",
                    background: selectedWebsite?.id === site.id
                      ? "var(--accent-light)"
                      : "var(--surface)",
                  }}
                >
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>{site.name}</div>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>{site.url}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Persona */}
      {step === "persona" && (
        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Select Persona
            </h2>
            <button
              onClick={() => setStep("site")}
              className="text-sm hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Change site
            </button>
          </div>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Writing for <strong style={{ color: "var(--foreground)" }}>{selectedWebsite?.name}</strong>
          </p>
          {personas.length === 0 ? (
            <div className="text-center py-8">
              <p className="mb-4" style={{ color: "var(--text-muted)" }}>
                No personas found. Create one first.
              </p>
              <Link
                href="/dashboard/personas/new"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Create Persona
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {personas.map((persona, i) => (
                <button
                  key={persona.id}
                  onClick={() => {
                    setSelectedPersona(persona);
                    setStep("brief");
                  }}
                  className="w-full text-left p-4 rounded-lg transition"
                  style={{
                    border: selectedPersona?.id === persona.id
                      ? "2px solid var(--accent)"
                      : "1px solid var(--border)",
                    background: selectedPersona?.id === persona.id
                      ? "var(--accent-light)"
                      : "var(--surface)",
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>
                      {persona.name}
                    </span>
                    {i === 0 && (persona.usage_count ?? 0) > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--success-light)", color: "var(--success)" }}
                      >
                        Recommended
                      </span>
                    )}
                    {persona.badges?.slice(0, 3).map((badge) => (
                      <span
                        key={badge}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {persona.bio || "No biography"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Article Brief */}
      {step === "brief" && (
        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Article Brief
            </h2>
            <button
              onClick={() => setStep("persona")}
              className="text-sm hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Change persona
            </button>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--foreground)" }}>{selectedWebsite?.name}</strong> &middot;{" "}
            <strong style={{ color: "var(--foreground)" }}>{selectedPersona?.name}</strong>
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Topic *
              </label>
              <input
                type="text"
                value={brief.topic}
                onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
                placeholder="e.g. How to optimize PrestaShop checkout for higher conversions"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Format
                </label>
                <select
                  value={brief.format}
                  onChange={(e) => setBrief({ ...brief, format: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  AI Model
                </label>
                <select
                  value={brief.model}
                  onChange={(e) => setBrief({ ...brief, model: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                >
                  {availableModels.length === 0 ? (
                    <option value="">No API keys configured</option>
                  ) : (
                    availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Target Length (words)
                </label>
                <input
                  type="number"
                  value={brief.targetLength}
                  onChange={(e) =>
                    setBrief({ ...brief, targetLength: parseInt(e.target.value) || 1500 })
                  }
                  min={300}
                  max={5000}
                  step={100}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Primary Keyword (optional)
              </label>
              <input
                type="text"
                value={brief.primaryKeyword}
                onChange={(e) => setBrief({ ...brief, primaryKeyword: e.target.value })}
                placeholder="e.g. prestashop checkout optimization"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Secondary Keywords (comma-separated, optional)
              </label>
              <input
                type="text"
                value={brief.secondaryKeywords}
                onChange={(e) => setBrief({ ...brief, secondaryKeywords: e.target.value })}
                placeholder="e.g. cart abandonment, checkout UX, payment gateway"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Additional Notes (optional)
              </label>
              <textarea
                value={brief.notes}
                onChange={(e) => setBrief({ ...brief, notes: e.target.value })}
                rows={3}
                placeholder="e.g. Focus on mobile checkout. Mention one-page checkout module."
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              />
            </div>

            <div className="pt-4 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => {
                  if (!brief.topic.trim()) return;
                  setStep("keywords");
                }}
                disabled={!brief.topic.trim()}
                className="px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Next: Keywords <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Keyword Research */}
      {step === "keywords" && (
        <KeywordResearchStep
          topic={brief.topic}
          currentPrimary={brief.primaryKeyword}
          currentSecondary={brief.secondaryKeywords}
          onApply={(primary, secondary) => {
            const pk = primary;
            const sk = secondary.join(", ");
            setBrief((prev) => ({
              ...prev,
              primaryKeyword: pk,
              secondaryKeywords: sk,
            }));
            setStep("generate");
            handleGenerate({ primaryKeyword: pk, secondaryKeywords: sk });
          }}
          onSkip={() => {
            setStep("generate");
            handleGenerate();
          }}
        />
      )}

      {/* Step 5: Generation / Editor */}
      {(step === "generate" || step === "done") && (
        <div className="space-y-6">
          {/* Generation status */}
          {isGenerating && (
            <div
              className="flex items-center gap-3 rounded-lg p-4"
              style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-medium">Generating article...</span>
            </div>
          )}

          {generationError && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{ background: "var(--danger-light)", color: "var(--danger)", border: "1px solid var(--danger)" }}
            >
              {generationError}
            </div>
          )}

          {step === "done" && !generationError && (
            <div
              className="flex items-center gap-3 rounded-lg p-4"
              style={{ background: "var(--success-light)", color: "var(--success)", border: "1px solid var(--border)" }}
            >
              <Check size={20} />
              <span className="text-sm font-medium">
                Article generated and saved as draft. You can now edit it below.
              </span>
            </div>
          )}

          {/* Meta fields — shown after generation */}
          {step === "done" && (
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Meta Tags
              </h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Meta Title
                  </label>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{
                      color: metaTitle.length > 60
                        ? "var(--danger)"
                        : metaTitle.length >= 50
                        ? "var(--success)"
                        : "var(--text-muted)",
                    }}
                  >
                    {metaTitle.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO-optimized page title (50-60 characters ideal)"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    border: `1px solid ${!metaTitle ? "var(--danger)" : "var(--border)"}`,
                    background: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Meta Description
                  </label>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{
                      color: metaDescription.length > 160
                        ? "var(--danger)"
                        : metaDescription.length >= 120
                        ? "var(--success)"
                        : "var(--text-muted)",
                    }}
                  >
                    {metaDescription.length}/160
                  </span>
                </div>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Compelling description for search results (120-160 characters ideal)"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    border: `1px solid ${!metaDescription ? "var(--danger)" : "var(--border)"}`,
                    background: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Tiptap editor — streams during generation, editable after */}
          {(generatedHtml || editedHtml) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {isGenerating ? "Article Preview" : "Edit Article"}
                </h2>
                <div className="flex items-center gap-2">
                  {step === "done" && articleId && (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Changes
                      </button>
                      <button
                        onClick={() => handleExport("html")}
                        className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        <Download size={14} /> HTML
                      </button>
                      <button
                        onClick={() => handleExport("markdown")}
                        className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        <Download size={14} /> Markdown
                      </button>
                      <button
                        onClick={() => handleExport("plain")}
                        className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        <Download size={14} /> Text
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveMessage && (
                <p
                  className="text-xs mb-2"
                  style={{ color: saveMessage === "Saved." ? "var(--success)" : "var(--danger)" }}
                >
                  {saveMessage}
                </p>
              )}

              <ArticleEditor
                content={isGenerating ? generatedHtml : editedHtml}
                streaming={isGenerating}
                editable={!isGenerating}
                onChange={(html) => setEditedHtml(html)}
              />
            </div>
          )}

          {/* SEO Audit */}
          {step === "done" && editedHtml && (
            <SeoCheckPanel
              articleId={articleId}
              html={editedHtml}
              metaTitle={metaTitle || undefined}
              metaDescription={metaDescription || undefined}
              primaryKeyword={brief.primaryKeyword}
              secondaryKeywords={
                brief.secondaryKeywords
                  ? brief.secondaryKeywords.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined
              }
              targetWordCount={brief.targetLength}
              onFixApplied={(fixedHtml) => setEditedHtml(fixedHtml)}
              onMetaChange={(title, desc) => {
                setMetaTitle(title);
                setMetaDescription(desc);
              }}
            />
          )}

          {/* Actions */}
          {step === "done" && (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => {
                  setStep("brief");
                  setGeneratedHtml("");
                  setEditedHtml("");
                  setArticleId(null);
                  setGenerationError("");
                  setSaveMessage("");
                  setMetaTitle("");
                  setMetaDescription("");
                }}
                className="text-sm font-medium hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Generate Another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
