"use server";

import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";

export async function createPersona(formData: FormData) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const bio = formData.get("bio") as string;

    const tone_formal = parseInt(formData.get("tone_formal") as string) || 50;
    const tone_warmth = parseInt(formData.get("tone_warmth") as string) || 50;
    const tone_conciseness = parseInt(formData.get("tone_conciseness") as string) || 50;
    const tone_humor = parseInt(formData.get("tone_humor") as string) || 50;

    const quirks = formData.get("quirks") as string;
    const signature_phrases = formData.get("signature_phrases") as string;
    const forbidden_words = formData.get("forbidden_words") as string;

    const supabase = await createClient();

    const { error } = await supabase
        .from("personas")
        .insert([{
            organization_id: org.id,
            name,
            bio,
            tone_formal,
            tone_warmth,
            tone_conciseness,
            tone_humor,
            quirks,
            signature_phrases,
            forbidden_words
        }]);

    if (error) {
        console.error(error);
        throw new Error("Failed to create persona");
    }

    revalidatePath("/dashboard/personas");
}

function parseJsonField(formData: FormData, key: string, fallback: unknown = []) {
    const raw = formData.get(key) as string;
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

export async function updatePersonaVoice(id: string, formData: FormData) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();

    const { error } = await supabase
        .from("personas")
        .update({
            name: formData.get("name") as string,
            bio: formData.get("bio") as string,
            methodology: formData.get("methodology") as string || null,
            tone_formal: parseInt(formData.get("tone_formal") as string) || 50,
            tone_warmth: parseInt(formData.get("tone_warmth") as string) || 50,
            tone_conciseness: parseInt(formData.get("tone_conciseness") as string) || 50,
            tone_humor: parseInt(formData.get("tone_humor") as string) || 50,
            tone_brand_loyalty: parseInt(formData.get("tone_brand_loyalty") as string) || 50,
            tone_authority: formData.get("tone_authority") as string || null,
            quirks: formData.get("quirks") as string,
            signature_phrases: formData.get("signature_phrases") as string,
            forbidden_words: formData.get("forbidden_words") as string,
            voice_principles: parseJsonField(formData, "voice_principles"),
            sentence_rules_do: parseJsonField(formData, "sentence_rules_do"),
            sentence_rules_dont: parseJsonField(formData, "sentence_rules_dont"),
            structural_patterns: parseJsonField(formData, "structural_patterns"),
            recurring_themes: parseJsonField(formData, "recurring_themes"),
            example_passages: parseJsonField(formData, "example_passages"),
            system_prompt_override: formData.get("system_prompt_override") as string || null,
            seo_heading_style: formData.get("seo_heading_style") as string || null,
            seo_meta_tone: formData.get("seo_meta_tone") as string || null,
            seo_article_length_min: parseInt(formData.get("seo_article_length_min") as string) || 800,
            seo_article_length_max: parseInt(formData.get("seo_article_length_max") as string) || 2000,
            seo_keyword_density: parseFloat(formData.get("seo_keyword_density") as string) || 1.5,
            seo_include_faq: formData.get("seo_include_faq") === "on",
            seo_include_toc: formData.get("seo_include_toc") === "on",
            badges: parseJsonField(formData, "badges", []),
        })
        .eq("id", id)
        .eq("organization_id", org.id);

    if (error) {
        console.error(error);
        throw new Error("Failed to update persona voice");
    }

    revalidatePath(`/dashboard/personas/${id}`);
}


export async function analyzePersonaVoice(personaId: string) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Verify persona belongs to org
    const { data: persona } = await supabase
        .from("personas")
        .select("id")
        .eq("id", personaId)
        .eq("organization_id", org.id)
        .single();

    if (!persona) throw new Error("Persona not found");

    // Fetch all writing samples
    const { data: samples } = await supabase
        .from("persona_writing_samples")
        .select("extracted_text")
        .eq("persona_id", personaId)
        .not("extracted_text", "is", null);

    if (!samples || samples.length === 0) {
        throw new Error("No writing samples with extracted text found. Upload at least one text sample first.");
    }

    const sampleTexts = samples
        .map(s => s.extracted_text)
        .filter((t): t is string => !!t);

    // Resolve provider keys (org DB → env fallback)
    const { data: orgData } = await supabase
        .from("organizations")
        .select("api_integration_keys")
        .eq("id", org.id)
        .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};
    const { decrypt } = await import("@/lib/crypto");

    type Provider = "anthropic" | "openai" | "gemini";
    const providerKeys: Partial<Record<Provider, string>> = {};

    function resolveKey(dbKey: string, envVar: string): string | undefined {
        if (storedKeys[dbKey]) {
            try { return decrypt(storedKeys[dbKey]); } catch { /* fall through */ }
        }
        return process.env[envVar] || undefined;
    }

    const anthropicKey = resolveKey("anthropic_api_key", "ANTHROPIC_API_KEY");
    const openaiKey = resolveKey("openai_api_key", "OPENAI_API_KEY");
    if (anthropicKey) providerKeys.anthropic = anthropicKey;
    if (openaiKey) providerKeys.openai = openaiKey;

    if (!Object.keys(providerKeys).length) {
        throw new Error("No API key configured. Add one in Settings.");
    }

    const { analyzeVoice } = await import("@/lib/persona/voice-analysis");
    const { analysis, generation } = await analyzeVoice(sampleTexts, providerKeys);

    // Save all rich voice fields to persona
    await supabase
        .from("personas")
        .update({
            voice_summary: analysis.voice_summary,
            voice_principles: analysis.voice_principles,
            sentence_rules_do: analysis.sentence_rules_do,
            sentence_rules_dont: analysis.sentence_rules_dont,
            recurring_themes: analysis.recurring_themes,
            tone_formal: analysis.tone_formal,
            tone_warmth: analysis.tone_warmth,
            tone_conciseness: analysis.tone_conciseness,
            tone_humor: analysis.tone_humor,
        })
        .eq("id", personaId);

    // Log usage
    const { logUsageEvent } = await import("@/lib/usage");
    await logUsageEvent({
        organizationId: org.id,
        userId: user?.id || "",
        eventType: "voice_analysis",
        modelUsed: generation.model,
        estimatedCostUsd: generation.costUsd,
    });

    revalidatePath(`/dashboard/personas/${personaId}`);
}

export async function installBuiltinPersonas() {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { BUILTIN_PERSONAS } = await import("@/lib/builtin-personas");

    let installed = 0;
    for (const persona of BUILTIN_PERSONAS) {
        // Check if already installed for this org
        const { data: existing } = await supabase
            .from("personas")
            .select("id")
            .eq("organization_id", org.id)
            .eq("builtin_slug", persona.builtin_slug)
            .limit(1)
            .single();

        if (existing) {
            // Update badges and other fields for already-installed personas
            await supabase
                .from("personas")
                .update({ badges: (persona as any).badges || [] })
                .eq("id", existing.id);
            continue;
        }

        const { error } = await supabase
            .from("personas")
            .insert({
                organization_id: org.id,
                ...persona,
            });

        if (error) {
            console.error(`Failed to install persona ${persona.name}:`, error);
        } else {
            installed++;
        }
    }

    revalidatePath("/dashboard/personas");
    return { installed };
}

export async function assignPersonaToWebsite(personaId: string, websiteId: string) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();

    await supabase
        .from("persona_website_assignments")
        .upsert(
            { persona_id: personaId, website_id: websiteId, usage_count: 0 },
            { onConflict: "persona_id,website_id" }
        );

    revalidatePath(`/dashboard/personas/${personaId}`);
}

export async function removePersonaFromWebsite(personaId: string, websiteId: string) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();

    await supabase
        .from("persona_website_assignments")
        .delete()
        .eq("persona_id", personaId)
        .eq("website_id", websiteId);

    revalidatePath(`/dashboard/personas/${personaId}`);
}
