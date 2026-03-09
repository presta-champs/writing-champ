export type SectionRegenNudge =
  | "shorter"
  | "longer"
  | "more formal"
  | "more casual"
  | "simpler"
  | "more detailed";

type SectionRegenInput = {
  fullArticleHtml: string;
  sectionHtml: string;
  persona?: {
    name?: string;
    bio?: string;
    voice_summary?: string;
    tone_formal?: number;
    tone_warmth?: number;
    tone_conciseness?: number;
    quirks?: string;
    signature_phrases?: string;
    [key: string]: unknown;
  };
  organization?: {
    editorial_pov?: string | null;
    editorial_person_rules?: string;
    editorial_commercial_tone?: string;
    editorial_dos?: string[];
    editorial_donts?: string[];
    editorial_custom_rules?: string;
    [key: string]: unknown;
  };
  website?: {
    name?: string;
    url?: string;
    site_description?: string;
    tone_guardrails?: string;
    banned_topics?: string;
    banned_words?: string;
    required_elements?: string;
    content_pillars?: string[];
    [key: string]: unknown;
  };
  nudge?: SectionRegenNudge;
  primaryKeyword?: string;
};

export function buildSectionRegenPrompt(input: SectionRegenInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const lines: string[] = [];
  lines.push("You are a professional content editor. Your task is to rewrite ONLY the provided section of an article.");
  lines.push("Maintain the same HTML structure and inline styling. Do not change or rewrite any other part of the article.");
  lines.push("Return ONLY the rewritten section HTML — nothing else.");

  if (input.persona?.voice_summary) {
    lines.push(`\nVoice: ${input.persona.voice_summary}`);
  }
  if (input.persona?.signature_phrases) {
    lines.push(`Signature phrases: ${input.persona.signature_phrases}`);
  }

  if (input.organization?.editorial_pov) {
    const povLabels: Record<string, string> = {
      first_person: "first person (I/we)",
      second_person: "second person (you)",
      third_person: "third person (the company/they)",
    };
    lines.push(`\nPOV: Write in ${povLabels[input.organization.editorial_pov] || input.organization.editorial_pov}.`);
  }
  if (input.organization?.editorial_commercial_tone) {
    lines.push(`Commercial tone: ${input.organization.editorial_commercial_tone}`);
  }
  if (input.organization?.editorial_dos?.length) {
    lines.push(`Always: ${input.organization.editorial_dos.join("; ")}`);
  }
  if (input.organization?.editorial_donts?.length) {
    lines.push(`Never: ${input.organization.editorial_donts.join("; ")}`);
  }

  if (input.website?.tone_guardrails) {
    lines.push(`\nTone guardrails: ${input.website.tone_guardrails}`);
  }
  if (input.website?.banned_words) {
    lines.push(`Banned words: ${input.website.banned_words}`);
  }

  if (input.primaryKeyword) {
    lines.push(`\nPrimary keyword (maintain if present): ${input.primaryKeyword}`);
  }

  if (input.nudge) {
    lines.push(`\nAdjustment requested: make this section ${input.nudge}.`);
  }

  const systemPrompt = lines.join("\n");

  const userPrompt = [
    "Here is the full article for context (DO NOT rewrite this):",
    "```html",
    input.fullArticleHtml.slice(0, 8000),
    "```",
    "",
    "Rewrite ONLY this section:",
    "```html",
    input.sectionHtml,
    "```",
    "",
    "Return the rewritten section HTML only.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}
