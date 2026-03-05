export type GenerationRequest = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  /** Per-org API key. Falls back to env var if not provided. */
  apiKey?: string;
  /** Target word count — used to calibrate max_tokens for length enforcement */
  targetWordCount?: number;
};

export type GenerationResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type StreamCallbacks = {
  onToken?: (token: string) => void;
  onComplete?: (result: GenerationResult) => void;
  onError?: (error: Error) => void;
};

export type ArticleBrief = {
  topic: string;
  format: string;
  targetLength: number;
  notes?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
};

export type PromptInput = {
  website: {
    name: string;
    url: string;
    site_description?: string;
    tone_guardrails?: string;
    banned_topics?: string;
    banned_words?: string;
    required_elements?: string;
    content_pillars?: string[];
  };
  persona: {
    name: string;
    bio?: string;
    tone_formal: number;
    tone_warmth: number;
    tone_conciseness: number;
    tone_humor: number;
    quirks?: string;
    forbidden_words?: string;
    signature_phrases?: string;
    voice_summary?: string;
    // Rich voice fields
    voice_principles?: { title: string; description: string }[];
    sentence_rules_do?: string[];
    sentence_rules_dont?: string[];
    structural_patterns?: { name: string; description: string }[];
    recurring_themes?: string[];
    example_passages?: { title: string; topic: string; text: string }[];
    system_prompt_override?: string;
    methodology?: string;
    tone_authority?: string;
    tone_brand_loyalty?: number;
    seo_heading_style?: string;
    seo_meta_tone?: string;
    seo_article_length_min?: number;
    seo_article_length_max?: number;
    seo_keyword_density?: number;
    seo_include_faq?: boolean;
    seo_include_toc?: boolean;
    seo_internal_linking?: number;
    seo_external_linking?: number;
  };
  brief: ArticleBrief;
  contentIndex?: ContentIndexEntry[];
};

export type ContentIndexEntry = {
  id: string;
  post_title: string;
  post_url: string;
  post_excerpt?: string;
};
