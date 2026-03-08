import type { PromptInput } from './types';

/**
 * Sanitize user-provided text before embedding in prompts.
 * Strips patterns that attempt to override system instructions
 * or break out of the prompt structure.
 */
function sanitizeUserContent(text: string): string {
  if (!text) return text;
  return text
    .replace(/^#{1,3}\s*(System|Instructions?|Rules?|Override|Ignore|Forget|Disregard)/gim, '')
    .replace(/\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|rules?|prompts?|context)/gi, '')
    .replace(/\b(do\s+not\s+follow|stop\s+following)\s+(the\s+)?(system|previous|above)\s+(prompt|instructions?|rules?)/gi, '');
}

function describeTone(value: number, lowLabel: string, highLabel: string): string {
  if (value <= 20) return `extremely ${lowLabel}`;
  if (value <= 40) return `leaning ${lowLabel}`;
  if (value <= 60) return `balanced between ${lowLabel} and ${highLabel}`;
  if (value <= 80) return `leaning ${highLabel}`;
  return `extremely ${highLabel}`;
}

export type SectionRegenNudge =
  | 'shorter'
  | 'longer'
  | 'more formal'
  | 'more casual'
  | 'simpler'
  | 'more detailed';

export type SectionRegenParams = {
  /** The full article HTML for context */
  fullArticleHtml: string;
  /** The selected section HTML to regenerate */
  sectionHtml: string;
  /** Persona voice settings (same fields as PromptInput['persona']) */
  persona: PromptInput['persona'];
  /** Organization editorial guidelines */
  organization?: PromptInput['organization'];
  /** Website brand voice settings */
  website?: PromptInput['website'];
  /** Optional nudge direction */
  nudge?: SectionRegenNudge;
  /** Primary keyword for SEO continuity */
  primaryKeyword?: string;
};

/**
 * Build system + user prompts for regenerating a single section of an article.
 * The prompt instructs the model to return ONLY the replacement HTML,
 * matching the persona's voice and maintaining continuity with the full article.
 */
export function buildSectionRegenPrompt(params: SectionRegenParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { fullArticleHtml, sectionHtml, persona, organization, website, nudge, primaryKeyword } = params;

  // --- System prompt: persona voice + editorial rules ---
  const systemParts: string[] = [];

  systemParts.push(
    `You are a professional content writer. Your task is to regenerate a specific section of an existing article. ` +
    `You must match the voice, tone, and style of the original article exactly. ` +
    `Return ONLY the replacement HTML for the selected section — no preamble, no explanation, no markdown fences, no surrounding context.`
  );

  // Organization editorial guidelines
  if (organization) {
    const editorialParts: string[] = [];
    if (organization.editorial_pov) {
      const povLabels: Record<string, string> = {
        first_person: 'first person (I/we)',
        second_person: 'second person (you/your)',
        third_person: 'third person (the company/they)',
      };
      editorialParts.push(`**Point of View**: ALWAYS write in ${povLabels[organization.editorial_pov] || organization.editorial_pov}.`);
    }
    if (organization.editorial_commercial_tone) {
      editorialParts.push(`**Commercial language policy**: ${sanitizeUserContent(organization.editorial_commercial_tone)}`);
    }
    if (organization.editorial_dos && organization.editorial_dos.length > 0) {
      editorialParts.push(`\n**ALWAYS do the following**:`);
      for (const rule of organization.editorial_dos) {
        editorialParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (organization.editorial_donts && organization.editorial_donts.length > 0) {
      editorialParts.push(`\n**NEVER do the following**:`);
      for (const rule of organization.editorial_donts) {
        editorialParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (editorialParts.length > 0) {
      systemParts.push(`\n## Editorial Guidelines\n${editorialParts.join('\n')}`);
    }
  }

  // Website brand voice
  if (website) {
    const brandParts: string[] = [];
    if (website.tone_guardrails) {
      brandParts.push(`Tone guardrails: ${sanitizeUserContent(website.tone_guardrails)}`);
    }
    if (website.banned_words) {
      brandParts.push(`NEVER use these words: ${sanitizeUserContent(website.banned_words)}`);
    }
    if (brandParts.length > 0) {
      systemParts.push(`\n## Brand Voice\n${brandParts.join('\n')}`);
    }
  }

  // Persona voice (reuses same assembly pattern from prompt.ts)
  if (persona.system_prompt_override) {
    systemParts.push(`\n## Persona\n${sanitizeUserContent(persona.system_prompt_override)}`);
  } else {
    const personaParts: string[] = [];
    personaParts.push(`You are writing as "${sanitizeUserContent(persona.name)}".`);
    if (persona.bio) {
      personaParts.push(`Background: ${sanitizeUserContent(persona.bio)}`);
    }
    if (persona.methodology) {
      personaParts.push(`Writing methodology: ${sanitizeUserContent(persona.methodology)}`);
    }

    const formalDesc = describeTone(persona.tone_formal, 'casual and conversational', 'formal and academic');
    const warmthDesc = describeTone(persona.tone_warmth, 'clinical and detached', 'warm and empathetic');
    const concisenessDesc = describeTone(persona.tone_conciseness, 'verbose and descriptive', 'concise and direct');
    const humorDesc = describeTone(persona.tone_humor, 'serious and straightforward', 'witty and humorous');
    personaParts.push(`Tone: ${formalDesc}. ${warmthDesc}. ${concisenessDesc}. ${humorDesc}.`);

    if (persona.tone_authority) {
      personaParts.push(`Authority stance: ${sanitizeUserContent(persona.tone_authority)}`);
    }

    if (persona.voice_principles && persona.voice_principles.length > 0) {
      personaParts.push(`\n### Core Voice Principles`);
      for (const p of persona.voice_principles) {
        personaParts.push(`- **${sanitizeUserContent(p.title)}**: ${sanitizeUserContent(p.description)}`);
      }
    }

    if (persona.sentence_rules_do && persona.sentence_rules_do.length > 0) {
      personaParts.push(`\n### Sentence-Level Rules -- DO`);
      for (const rule of persona.sentence_rules_do) {
        personaParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (persona.sentence_rules_dont && persona.sentence_rules_dont.length > 0) {
      personaParts.push(`\n### Sentence-Level Rules -- DON'T`);
      for (const rule of persona.sentence_rules_dont) {
        personaParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }

    if (persona.quirks) {
      personaParts.push(`Stylistic quirks: ${sanitizeUserContent(persona.quirks)}`);
    }
    if (persona.forbidden_words) {
      personaParts.push(`NEVER use these words: ${sanitizeUserContent(persona.forbidden_words)}`);
    }
    if (persona.signature_phrases) {
      personaParts.push(`Signature phrases: ${sanitizeUserContent(persona.signature_phrases)}`);
    }

    systemParts.push(`\n## Persona\n${personaParts.join('\n')}`);

    if (persona.voice_summary) {
      systemParts.push(`\n## Voice Reference\nMatch this voice closely:\n${sanitizeUserContent(persona.voice_summary)}`);
    }
  }

  // Example passages
  if (persona.example_passages && persona.example_passages.length > 0) {
    const exParts: string[] = [];
    exParts.push(`Study these example passages. Match the tone, rhythm, and style exactly.`);
    for (const ex of persona.example_passages) {
      exParts.push(`\n### ${sanitizeUserContent(ex.title)} (Topic: ${sanitizeUserContent(ex.topic)})\n${sanitizeUserContent(ex.text)}`);
    }
    systemParts.push(`\n## Example Passages\n${exParts.join('\n')}`);
  }

  // --- User prompt: the actual regeneration task ---
  const userParts: string[] = [];

  userParts.push(`## Task: Regenerate One Section`);
  userParts.push(`Below is the full article for context. DO NOT regenerate the entire article. Only regenerate the specific section marked below.`);

  userParts.push(`\n## Full Article (context only — do not reproduce)\n${fullArticleHtml}`);

  userParts.push(`\n## Section to Regenerate\nRewrite ONLY this section:\n${sectionHtml}`);

  if (primaryKeyword) {
    userParts.push(`\n## SEO Continuity\nPrimary keyword: "${primaryKeyword}". If the original section contained this keyword, include it naturally in the rewritten section as well.`);
  }

  if (nudge) {
    const nudgeInstructions: Record<SectionRegenNudge, string> = {
      'shorter': 'Make this section significantly shorter. Cut filler, tighten sentences, remove redundancy. Aim for roughly half the current length.',
      'longer': 'Expand this section with more depth. Add concrete examples, data points, or practical details. Aim for roughly 50% more content.',
      'more formal': 'Rewrite this section in a more formal, professional tone. Use precise language, avoid contractions, and maintain an authoritative voice.',
      'more casual': 'Rewrite this section in a more casual, conversational tone. Use contractions, shorter sentences, and a friendly voice.',
      'simpler': 'Simplify this section. Use shorter sentences, simpler vocabulary, and break down complex ideas. Target an 8th-grade reading level.',
      'more detailed': 'Add more specific details, examples, statistics, or step-by-step explanations to this section. Be concrete rather than abstract.',
    };
    userParts.push(`\n## Adjustment\n${nudgeInstructions[nudge]}`);
  }

  userParts.push(`\n## Output Rules
- Return ONLY the replacement HTML for the section above.
- Use clean semantic HTML: h2, h3, p, ul, ol, li, strong, em, a, blockquote.
- Do NOT wrap the output in markdown code fences.
- Do NOT include any explanation, commentary, or preamble.
- Do NOT reproduce the rest of the article.
- Maintain continuity with the content that comes before and after this section.
- Match the heading level of the original section (if the section starts with h2, start with h2).`);

  return {
    systemPrompt: systemParts.join('\n'),
    userPrompt: userParts.join('\n'),
  };
}
