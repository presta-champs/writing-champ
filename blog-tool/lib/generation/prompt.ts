import type { PromptInput } from './types';

/**
 * Sanitize user-provided text before embedding in prompts.
 * Strips patterns that attempt to override system instructions
 * or break out of the prompt structure.
 */
function sanitizeUserContent(text: string): string {
  if (!text) return text;
  return text
    // Strip markdown heading markers that could create fake prompt sections
    .replace(/^#{1,3}\s*(System|Instructions?|Rules?|Override|Ignore|Forget|Disregard)/gim, '')
    // Strip common prompt injection patterns (only match full injection phrases, not partial)
    .replace(/\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|rules?|prompts?|context)/gi, '')
    .replace(/\b(do\s+not\s+follow|stop\s+following)\s+(the\s+)?(system|previous|above)\s+(prompt|instructions?|rules?)/gi, '');
}

const OVERUSED_WORDS = `delve, robust, pivotal, seamless, leverage, realm, tapestry, groundbreaking, comprehensive, paramount, nuanced, multifaceted, holistic, dynamic, transformative, unlock, unleash, empower, foster, synergy, game-changer, cutting-edge, state-of-the-art, unparalleled, actionable insights, best practices, thought leadership, stakeholders, deliverables, key takeaways, value proposition, pain point, touchpoint, roadmap, streamline, optimize, scalable, paradigm shift, it is important to note, it is worth noting, in conclusion, furthermore, moreover, additionally, consequently, accordingly, in today's fast-paced world, in the realm of, navigating the landscape, pave the way for, at the forefront of, bridging the gap between, embark on a journey, harness the power of, unlock the potential of, treasure trove, uncharted waters, the next frontier, crucial, essential, fundamental, vital, significant, substantial, remarkable, invaluable, impactful, utilize, facilitate, enhance, elevate, amplify, augment, elucidate, underscores, showcasing, aligns, resonate, thrive, capitalize on, spearhead, aims to explore, notably, that being said, simply put, in summary, to summarize, at the end of the day, ultimately, as we have seen, in other words, whilst, notwithstanding, herein, heretofore, commendable, esteemed, enlightening, thought-provoking, vibrant, burgeoning, pervasive, entrenched, relentless, well-crafted`;

function describeTone(value: number, lowLabel: string, highLabel: string): string {
  if (value <= 20) return `extremely ${lowLabel}`;
  if (value <= 40) return `leaning ${lowLabel}`;
  if (value <= 60) return `balanced between ${lowLabel} and ${highLabel}`;
  if (value <= 80) return `leaning ${highLabel}`;
  return `extremely ${highLabel}`;
}

/**
 * Build a section-level word budget breakdown based on target length and format.
 * Gives the model a concrete plan to follow for hitting the word count.
 */
function buildSectionBudget(targetLength: number, format: string, includeFaq: boolean, includeToc: boolean): string {
  const fmt = format.toLowerCase();
  const lines: string[] = [];

  // Determine section structure based on format
  let introRatio = 0.08;
  let conclusionRatio = 0.07;
  let faqRatio = includeFaq ? 0.12 : 0;
  let tocRatio = includeToc ? 0.02 : 0;
  let bodyRatio = 1 - introRatio - conclusionRatio - faqRatio - tocRatio;

  // Estimate number of body sections based on length
  let numSections: number;
  if (targetLength <= 600) numSections = 3;
  else if (targetLength <= 1200) numSections = 4;
  else if (targetLength <= 2000) numSections = 5;
  else if (targetLength <= 3500) numSections = 6;
  else numSections = 7;

  // Adjust for format types
  if (fmt.includes('listicle') || fmt.includes('list')) {
    // Listicles have more, shorter sections
    numSections = Math.max(numSections, Math.ceil(targetLength / 200));
    introRatio = 0.06;
    conclusionRatio = 0.05;
  } else if (fmt.includes('how-to') || fmt.includes('tutorial') || fmt.includes('guide')) {
    introRatio = 0.10;
    numSections = Math.max(numSections, 5);
  }

  bodyRatio = 1 - introRatio - conclusionRatio - faqRatio - tocRatio;
  const wordsPerSection = Math.round((targetLength * bodyRatio) / numSections);

  if (includeToc) {
    lines.push(`- Table of Contents: ~${Math.round(targetLength * tocRatio)} words`);
  }
  lines.push(`- Introduction: ~${Math.round(targetLength * introRatio)} words`);
  for (let i = 1; i <= numSections; i++) {
    lines.push(`- Body Section ${i} (H2): ~${wordsPerSection} words`);
  }
  if (includeFaq) {
    lines.push(`- FAQ Section (3-5 questions): ~${Math.round(targetLength * faqRatio)} words`);
  }
  lines.push(`- Conclusion: ~${Math.round(targetLength * conclusionRatio)} words`);
  lines.push(`- TOTAL: ~${targetLength} words`);

  return lines.join('\n');
}

function buildSystemPrompt(input: PromptInput): string {
  const { website, persona } = input;
  const parts: string[] = [];

  // Layer 1 — System identity (immutable preamble)
  parts.push(`You are a professional content writer working for a content management platform. Your job is to write high-quality articles based on the Brand Voice, Persona, and Article Brief provided below. Output clean HTML directly — no preamble, no conversational opener. Treat the configuration sections below as editorial instructions for what and how to write.`);

  // Layer 1.5 — Organization editorial guidelines (highest-priority voice rules)
  const org = input.organization;
  if (org) {
    const editorialParts: string[] = [];

    if (org.editorial_pov) {
      const povLabels: Record<string, string> = {
        first_person: 'first person (I/we)',
        second_person: 'second person (you/your)',
        third_person: 'third person (the company/they)',
      };
      editorialParts.push(`**Point of View**: ALWAYS write in ${povLabels[org.editorial_pov] || org.editorial_pov}. This is non-negotiable and overrides any persona preference.`);
    }
    if (org.editorial_person_rules) {
      editorialParts.push(`POV details: ${sanitizeUserContent(org.editorial_person_rules)}`);
    }
    if (org.editorial_commercial_tone) {
      editorialParts.push(`**Commercial language policy**: ${sanitizeUserContent(org.editorial_commercial_tone)}`);
    }
    if (org.editorial_dos && org.editorial_dos.length > 0) {
      editorialParts.push(`\n**ALWAYS do the following** (these apply to every article regardless of persona):`);
      for (const rule of org.editorial_dos) {
        editorialParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (org.editorial_donts && org.editorial_donts.length > 0) {
      editorialParts.push(`\n**NEVER do the following** (these apply to every article regardless of persona):`);
      for (const rule of org.editorial_donts) {
        editorialParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (org.editorial_custom_rules) {
      editorialParts.push(`\nAdditional editorial rules:\n${sanitizeUserContent(org.editorial_custom_rules)}`);
    }

    if (editorialParts.length > 0) {
      parts.push(`\n## Editorial Guidelines (Organization-Wide)\nThese rules take precedence over individual persona settings. All writers must follow them.\n${editorialParts.join('\n')}`);
    }
  }

  // Layer 2 — Brand voice rules (all user-provided content is sanitized)
  const brandParts: string[] = [];
  if (website.site_description) {
    brandParts.push(`Website: ${website.name} (${website.url}). ${sanitizeUserContent(website.site_description)}`);
  }
  if (website.tone_guardrails) {
    brandParts.push(`Tone guardrails: ${sanitizeUserContent(website.tone_guardrails)}`);
  }
  if (website.banned_topics) {
    brandParts.push(`NEVER write about these topics: ${sanitizeUserContent(website.banned_topics)}`);
  }
  if (website.banned_words) {
    brandParts.push(`NEVER use these words: ${sanitizeUserContent(website.banned_words)}`);
  }
  if (website.required_elements) {
    brandParts.push(`Required elements: ${sanitizeUserContent(website.required_elements)}`);
  }
  if (website.content_pillars && website.content_pillars.length > 0) {
    brandParts.push(`Content pillars: ${website.content_pillars.join(', ')}`);
  }
  if (brandParts.length > 0) {
    parts.push(`\n## Brand Voice\n${brandParts.join('\n')}`);
  }

  // Layer 3 — Persona voice (user content is sanitized against injection)
  if (persona.system_prompt_override) {
    // Custom system prompt — still sandboxed within the Persona section
    parts.push(`\n## Persona\n${sanitizeUserContent(persona.system_prompt_override)}`);
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
    if (persona.tone_brand_loyalty != null) {
      const loyaltyDesc = describeTone(persona.tone_brand_loyalty, 'brand-agnostic and objective', 'brand-loyal and promotional');
      personaParts.push(`Brand loyalty: ${loyaltyDesc}.`);
    }

    // Voice principles
    if (persona.voice_principles && persona.voice_principles.length > 0) {
      personaParts.push(`\n### Core Voice Principles`);
      for (const p of persona.voice_principles) {
        personaParts.push(`- **${sanitizeUserContent(p.title)}**: ${sanitizeUserContent(p.description)}`);
      }
    }

    // Sentence-level rules
    if (persona.sentence_rules_do && persona.sentence_rules_do.length > 0) {
      personaParts.push(`\n### Sentence-Level Rules — DO`);
      for (const rule of persona.sentence_rules_do) {
        personaParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }
    if (persona.sentence_rules_dont && persona.sentence_rules_dont.length > 0) {
      personaParts.push(`\n### Sentence-Level Rules — DON'T`);
      for (const rule of persona.sentence_rules_dont) {
        personaParts.push(`- ${sanitizeUserContent(rule)}`);
      }
    }

    // Structural patterns
    if (persona.structural_patterns && persona.structural_patterns.length > 0) {
      personaParts.push(`\n### Structural Patterns`);
      for (const sp of persona.structural_patterns) {
        personaParts.push(`- **${sanitizeUserContent(sp.name)}**: ${sanitizeUserContent(sp.description)}`);
      }
    }

    // Recurring themes
    if (persona.recurring_themes && persona.recurring_themes.length > 0) {
      personaParts.push(`\n### Recurring Themes\nWeave these themes naturally into the writing: ${persona.recurring_themes.map(t => sanitizeUserContent(t)).join(', ')}`);
    }

    if (persona.quirks) {
      personaParts.push(`\nStylistic quirks to adopt: ${sanitizeUserContent(persona.quirks)}`);
    }
    if (persona.forbidden_words) {
      personaParts.push(`NEVER use these words (persona-level): ${sanitizeUserContent(persona.forbidden_words)}`);
    }
    if (persona.signature_phrases) {
      personaParts.push(`Signature phrases to use naturally: ${sanitizeUserContent(persona.signature_phrases)}`);
    }

    parts.push(`\n## Persona\n${personaParts.join('\n')}`);

    // Voice grounding
    if (persona.voice_summary) {
      parts.push(`\n## Voice Reference\nHere is an AI-analyzed summary of this writer's authentic voice. Match it closely:\n${sanitizeUserContent(persona.voice_summary)}`);
    }
  }

  // Example passages — always included regardless of system_prompt_override
  if (persona.example_passages && persona.example_passages.length > 0) {
    const exParts: string[] = [];
    exParts.push(`Study these example passages. Match the tone, rhythm, and style exactly.`);
    for (const ex of persona.example_passages) {
      exParts.push(`\n### ${sanitizeUserContent(ex.title)} (Topic: ${sanitizeUserContent(ex.topic)})\n${sanitizeUserContent(ex.text)}`);
    }
    parts.push(`\n## Example Passages\n${exParts.join('\n')}`);
  }

  return parts.join('\n');
}

function buildUserPrompt(input: PromptInput): string {
  const { brief, persona } = input;
  const parts: string[] = [];

  // Layer 5 — SEO instructions (enforced strictly — these rules are scored by the SEO audit)
  {
    const seoParts: string[] = [];

    // Keyword placement rules
    if (brief.primaryKeyword) {
      seoParts.push(`Primary keyword: "${brief.primaryKeyword}"`);
      seoParts.push(`Keywords are provided in lowercase for reference. Use proper natural casing in the article (e.g., "ai customer support" → "AI Customer Support" in titles, "AI customer support" in body text).`);
      seoParts.push(`Place the primary keyword in ALL of these locations (mandatory — the SEO audit checks each one):`);
      seoParts.push(`  1. The article title (H1 or the first heading)`);
      seoParts.push(`  2. The first paragraph of the article`);
      seoParts.push(`  3. At least one H2 heading`);
      seoParts.push(`  4. At least one image alt text attribute`);
      seoParts.push(`  5. Naturally throughout the body text`);
      const density = persona.seo_keyword_density ?? 1.5;
      seoParts.push(`Target keyword density: ~${density}% of total words (acceptable range: ${(density * 0.5).toFixed(1)}%–${(density * 2).toFixed(1)}%).`);
    }
    if (brief.secondaryKeywords && brief.secondaryKeywords.length > 0) {
      seoParts.push(`Secondary keywords — use each at least once: ${brief.secondaryKeywords.join(', ')}`);
    }

    // Heading structure rules (scored by audit)
    seoParts.push(`\n### Heading Structure Rules (STRICT)`);
    seoParts.push(`- Use exactly ONE H1 tag for the article title. Never add a second H1.`);
    seoParts.push(`- Follow proper heading hierarchy: H1 → H2 → H3. NEVER skip levels (e.g., no H1 → H3 without H2 between them).`);
    const maxDepth = persona.seo_heading_depth;
    if (maxDepth) {
      seoParts.push(`- Maximum heading depth: H${maxDepth}. Do not use H${maxDepth + 1} or deeper.`);
    } else {
      seoParts.push(`- Use H2 for main sections and H3 for subsections. Avoid H4 or deeper unless the article is very long.`);
    }

    // Readability rules (scored by audit — Flesch-Kincaid)
    const readabilityTarget = input.brief.readabilityTarget ?? 50;
    const gradeHint = readabilityTarget >= 70 ? '7th-grade' : readabilityTarget >= 60 ? '8th-9th grade' : readabilityTarget >= 50 ? '10th-12th grade' : 'college';
    seoParts.push(`\n### Readability Rules`);
    seoParts.push(`- Write at a Flesch-Kincaid reading ease score of ${readabilityTarget} or higher (${gradeHint} level).`);
    seoParts.push(`- Use short sentences (under 25 words on average). Mix short and medium sentences for rhythm.`);
    seoParts.push(`- Use short paragraphs (2-4 sentences). Break up walls of text.`);
    seoParts.push(`- Prefer common words over jargon. Explain technical terms when first used.`);
    seoParts.push(`- Use active voice. Minimize passive constructions.`);

    // Link rules
    if (persona.seo_external_linking != null && persona.seo_external_linking > 0) {
      seoParts.push(`\nInclude at least ${persona.seo_external_linking} outbound links to authoritative external sources (real, relevant URLs).`);
    } else {
      seoParts.push(`\nInclude at least 1 outbound link to an authoritative external source.`);
    }

    // Persona-level SEO settings
    if (persona.seo_heading_style) {
      seoParts.push(`Heading style: ${sanitizeUserContent(persona.seo_heading_style)}`);
    }
    if (persona.seo_meta_tone) {
      seoParts.push(`Meta description tone: ${sanitizeUserContent(persona.seo_meta_tone)}`);
    }
    if (persona.seo_include_faq) {
      seoParts.push(`Include a FAQ section with 3-5 questions near the end of the article.`);
    }
    if (persona.seo_include_toc) {
      seoParts.push(`Include a table of contents after the introduction.`);
    }
    parts.push(`## SEO\n${seoParts.join('\n')}`);
  }

  // Layer 6 — Internal linking reference
  if (input.contentIndex && input.contentIndex.length > 0) {
    const linkingLevel = input.persona.seo_internal_linking ?? 3;
    const linkEntries = input.contentIndex
      .slice(0, 20) // cap at 20 entries to stay within context
      .map((entry) => `- [${entry.post_title}](${entry.post_url})${entry.post_excerpt ? `: ${entry.post_excerpt}` : ''}`)
      .join('\n');
    const linkParts: string[] = [];
    linkParts.push(`Link to relevant published articles from this site when they add value for the reader.`);
    linkParts.push(`Target approximately ${linkingLevel} internal links.`);
    linkParts.push(`Use natural anchor text — do not force keyword-stuffed links.`);
    linkParts.push(`\nAvailable pages to link to:\n${linkEntries}`);
    parts.push(`\n## Internal Linking\n${linkParts.join('\n')}`);
  }

  // Layer 7 — Article brief with strict word count enforcement
  const targetLength = brief.targetLength || (persona.seo_article_length_min && persona.seo_article_length_max
    ? Math.round((persona.seo_article_length_min + persona.seo_article_length_max) / 2)
    : 1200);
  const minWords = Math.round(targetLength * 0.92);
  const maxWords = Math.round(targetLength * 1.08);
  const briefParts: string[] = [];
  briefParts.push(`Topic: ${sanitizeUserContent(brief.topic)}`);
  briefParts.push(`Format: ${brief.format}`);
  if (brief.notes) {
    briefParts.push(`Additional notes: ${sanitizeUserContent(brief.notes)}`);
  }
  parts.push(`\n## Article Brief\n${briefParts.join('\n')}`);

  // Layer 7b — Word count enforcement (separate section for emphasis)
  const sectionBudget = buildSectionBudget(targetLength, brief.format, !!persona.seo_include_faq, !!persona.seo_include_toc);
  parts.push(`\n## Word Count Target
Write exactly ${targetLength} words (acceptable range: ${minWords}–${maxWords}).

Plan your article using these section budgets:
${sectionBudget}

Keep a running tally as you write each section. If you're running long, tighten sentences and cut filler. If you're running short, add a concrete example or expand a key point. The final article should land within the ${minWords}–${maxWords} word range.`);

  // Layer 8 — Image placement (scored by SEO audit: images-present, images-alt-text, images-keyword-alt)
  {
    const altKeywordNote = brief.primaryKeyword
      ? ` Include the primary keyword "${brief.primaryKeyword}" in at least one image alt text.`
      : '';
    parts.push(`\n## Images
Insert exactly formatted [IMAGE: descriptive prompt] markers (square brackets included, no nesting) at natural breaks in the article. Place one before the first paragraph for the featured image. Include 2-4 markers total. The description should be specific enough to search stock photos or generate with AI, e.g. [IMAGE: developer reviewing code on dual monitors in modern office].

Every [IMAGE:] marker MUST have a descriptive alt-text-ready description — this becomes the image alt attribute.${altKeywordNote}
Do NOT leave any image without a description.`);
  }

  // Layer 9 — Output format
  parts.push(`\n## Output Format
- Use clean semantic HTML: h1, h2, h3, p, ul, ol, li, strong, em, a, blockquote, img.
- Start with exactly one <h1> tag for the article title. Do NOT add any more <h1> tags.
- Use <h2> for main sections, <h3> for subsections. Never skip from h1 to h3 or h2 to h4.
- No wrapper divs or CSS classes.
- Avoid these overused filler words and phrases: ${OVERUSED_WORDS}
- Open with substance, not a broad statement about the topic's importance.
- Close with substance, not "In conclusion" or a recap.
- Skip "Key takeaways" or "Final thoughts" sections.
- Use bold sparingly and purposefully — not as random textbook highlighting.
- Every paragraph should earn its place.
- Keep sentences short and clear. Aim for average sentence length under 20 words.`);

  // Layer 10 — Meta tag generation (always included)
  {
    const metaTone = persona.seo_meta_tone ? ` Tone: ${sanitizeUserContent(persona.seo_meta_tone)}.` : '';
    const keywordTitleRule = brief.primaryKeyword
      ? `\n- Place the primary keyword "${brief.primaryKeyword}" near the beginning.`
      : '';
    const keywordDescRule = brief.primaryKeyword
      ? `\n- Include the primary keyword "${brief.primaryKeyword}" naturally within the first 100 characters.`
      : '';
    parts.push(`\n## Meta Tags
After the article HTML, output a meta block in this exact format:

<!--META
TITLE: Your meta title here
DESCRIPTION: Your meta description here
META-->

Meta title rules:
- 50–60 characters (hard limit: 60). Shorter is better than truncated.${keywordTitleRule}
- Make it specific and compelling — not generic. Promise a clear benefit or answer.
- No clickbait, no ALL CAPS, no excessive punctuation.${metaTone}

Meta description rules:
- 120–155 characters (hard limit: 160). Aim for 140–155.${keywordDescRule}
- Write a complete, compelling sentence — not a fragment.
- Include a call to action or value proposition ("Learn how...", "Discover...", "Here's what...").
- Match the search intent — if the article is a how-to, promise practical steps.
- No keyword stuffing. No repeating the title verbatim.${metaTone}`);
  }

  // Final instruction
  parts.push(`\nWrite the article now. Start immediately with the first HTML heading or paragraph. End with the <!--META block.`);

  return parts.join('\n');
}

/**
 * Assemble the full prompt from website, persona, and brief inputs.
 * Returns system prompt and user prompt as separate strings.
 */
export function assemblePrompt(input: PromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildSystemPrompt(input),
    userPrompt: buildUserPrompt(input),
  };
}
