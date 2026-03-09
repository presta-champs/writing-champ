"use server";

import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

// The keys we support storing per-org
const SUPPORTED_KEYS = [
  "anthropic_api_key",
  "openai_api_key",
  "google_ai_api_key",
  "unsplash_access_key",
  "pexels_api_key",
  "surfer_seo_api_key",
] as const;

type KeyName = typeof SUPPORTED_KEYS[number];

const KEY_LABELS: Record<KeyName, string> = {
  anthropic_api_key: "Anthropic (Claude)",
  openai_api_key: "OpenAI (GPT)",
  google_ai_api_key: "Google AI (Gemini)",
  unsplash_access_key: "Unsplash",
  pexels_api_key: "Pexels",
  surfer_seo_api_key: "Surfer SEO",
};

/**
 * Get the masked versions of all stored API keys for display.
 */
export async function getApiKeyStatus(): Promise<
  { key: KeyName; label: string; isSet: boolean; masked: string }[]
> {
  const org = await useOrganization();
  if (!org) throw new Error("Not authorized");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("api_integration_keys")
    .eq("id", org.id)
    .single();

  const stored: Record<string, string> = data?.api_integration_keys || {};

  return SUPPORTED_KEYS.map((key) => {
    const encValue = stored[key];
    let isSet = false;
    let masked = "";
    if (encValue) {
      try {
        const plaintext = decrypt(encValue);
        isSet = plaintext.length > 0;
        masked = maskKey(plaintext);
      } catch {
        // Decryption failed — key is corrupt, treat as unset
      }
    }
    return { key, label: KEY_LABELS[key], isSet, masked };
  });
}

/**
 * Save an API key (encrypted) for the current org.
 */
export async function saveApiKey(keyName: string, value: string): Promise<{ success: boolean; error?: string }> {
  if (!SUPPORTED_KEYS.includes(keyName as KeyName)) {
    return { success: false, error: "Invalid key name" };
  }

  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  // Only admins can change API keys
  if (org.role !== "admin") {
    return { success: false, error: "Only admins can manage API keys" };
  }

  const supabase = await createClient();

  // Get current keys
  const { data } = await supabase
    .from("organizations")
    .select("api_integration_keys")
    .eq("id", org.id)
    .single();

  const stored: Record<string, string> = data?.api_integration_keys || {};

  if (value.trim()) {
    stored[keyName] = encrypt(value.trim());
  } else {
    delete stored[keyName];
  }

  const { error } = await supabase
    .from("organizations")
    .update({ api_integration_keys: stored })
    .eq("id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Get a decrypted API key for server-side use (e.g., in the generation pipeline).
 * Falls back to env var if no org key is set.
 */
export async function getDecryptedApiKey(keyName: KeyName): Promise<string | null> {
  const org = await useOrganization();
  if (!org) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("api_integration_keys")
    .eq("id", org.id)
    .single();

  const stored: Record<string, string> = data?.api_integration_keys || {};
  const encValue = stored[keyName];

  if (encValue) {
    try {
      const plaintext = decrypt(encValue);
      if (plaintext.length > 0) return plaintext;
    } catch {
      // Decryption failed, fall through to env
    }
  }

  // Fallback to env var
  const envMap: Record<KeyName, string> = {
    anthropic_api_key: "ANTHROPIC_API_KEY",
    openai_api_key: "OPENAI_API_KEY",
    google_ai_api_key: "GOOGLE_AI_API_KEY",
    unsplash_access_key: "UNSPLASH_ACCESS_KEY",
    pexels_api_key: "PEXELS_API_KEY",
    surfer_seo_api_key: "SURFER_SEO_API_KEY",
  };

  return process.env[envMap[keyName]] || null;
}

/**
 * Update the organization name.
 */
export async function updateOrgName(name: string): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin") return { success: false, error: "Only admins can change org settings" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Name is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: trimmed })
    .eq("id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Get the current organization's editorial guidelines.
 */
export async function getEditorialGuidelines() {
  const org = await useOrganization();
  if (!org) throw new Error("Not authorized");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("editorial_pov, editorial_person_rules, editorial_commercial_tone, editorial_dos, editorial_donts, editorial_custom_rules")
    .eq("id", org.id)
    .single();

  return {
    editorial_pov: data?.editorial_pov || null,
    editorial_person_rules: data?.editorial_person_rules || "",
    editorial_commercial_tone: data?.editorial_commercial_tone || "",
    editorial_dos: (data?.editorial_dos as string[]) || [],
    editorial_donts: (data?.editorial_donts as string[]) || [],
    editorial_custom_rules: data?.editorial_custom_rules || "",
  };
}

/**
 * Save organization editorial guidelines.
 */
export async function updateEditorialGuidelines(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin") return { success: false, error: "Only admins can change editorial guidelines" };

  const editorial_pov = formData.get("editorial_pov") as string || null;
  const editorial_person_rules = formData.get("editorial_person_rules") as string || null;
  const editorial_commercial_tone = formData.get("editorial_commercial_tone") as string || null;
  const editorial_custom_rules = formData.get("editorial_custom_rules") as string || null;

  // Parse dos/donts from JSON hidden fields
  let editorial_dos: string[] = [];
  let editorial_donts: string[] = [];
  try {
    editorial_dos = JSON.parse(formData.get("editorial_dos") as string || "[]");
  } catch { /* keep empty */ }
  try {
    editorial_donts = JSON.parse(formData.get("editorial_donts") as string || "[]");
  } catch { /* keep empty */ }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      editorial_pov: editorial_pov || null,
      editorial_person_rules: editorial_person_rules || null,
      editorial_commercial_tone: editorial_commercial_tone || null,
      editorial_dos,
      editorial_donts,
      editorial_custom_rules: editorial_custom_rules || null,
    })
    .eq("id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Get the current organization's default AI model.
 */
export async function getDefaultModel(): Promise<string | null> {
  const org = await useOrganization();
  if (!org) throw new Error("Not authorized");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("default_model")
    .eq("id", org.id)
    .single();

  return data?.default_model || null;
}

/**
 * Update the organization's default AI model.
 * Pass null to clear the default (users will pick per-generation).
 */
export async function updateDefaultModel(
  model: string | null
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin") return { success: false, error: "Only admins can change the default model" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ default_model: model || null })
    .eq("id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

/**
 * Get whether external SEO grading (Surfer SEO) is enabled for the org.
 */
export async function getExternalSeoEnabled(): Promise<boolean> {
  const org = await useOrganization();
  if (!org) throw new Error("Not authorized");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("external_seo_enabled")
    .eq("id", org.id)
    .single();

  return data?.external_seo_enabled ?? false;
}

/**
 * Toggle external SEO grading (Surfer SEO) for the org.
 */
export async function updateExternalSeoEnabled(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin") return { success: false, error: "Only admins can change SEO settings" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ external_seo_enabled: enabled })
    .eq("id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}
