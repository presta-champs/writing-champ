export type VoicePrinciple = {
    title: string;
    description: string;
};

export type StructuralPattern = {
    name: string;
    description: string;
};

export type ExamplePassage = {
    title: string;
    topic: string;
    text: string;
};

export type Organization = {
    id: string;
    name: string;
    plan?: string;
    article_limit?: number;
    approval_workflow_enabled: boolean;
    external_seo_grader_enabled: boolean;
    api_integration_keys?: Record<string, any>;
    created_at: string;
};

export type User = {
    id: string;
    email: string;
    name?: string;
    created_at: string;
};

export type Website = {
    id: string;
    organization_id: string;
    name: string;
    url: string;
    platform_type: 'wordpress' | 'prestashop' | 'custom';
    mcp_server_url?: string;
    mcp_auth_token?: string; // encrypted
    mcp_status: 'connected' | 'error' | 'unconfigured';
    mcp_last_synced?: string;
    // Brand voice
    site_description?: string;
    tone_guardrails?: string;
    banned_topics?: string;
    banned_words?: string;
    required_elements?: string;
    content_pillars?: string[];
    // Specialty profile
    specialty_summary?: string;
    specialty_topics?: string[];
    primary_url?: string;
    // News feed config
    feed_topics?: string[];
    feed_keywords_include?: string[];
    feed_keywords_exclude?: string[];
    feed_refresh_interval_hours?: number;
    created_at: string;
};

export type Persona = {
    id: string;
    organization_id: string;
    name: string;
    bio?: string;
    avatar_url?: string;
    // Voice params
    tone_formal: number;
    tone_warmth: number;
    tone_conciseness: number;
    tone_humor: number;
    quirks?: string;
    forbidden_words?: string;
    signature_phrases?: string;
    voice_summary?: string;
    // Rich voice definition
    voice_principles?: VoicePrinciple[];
    sentence_rules_do?: string[];
    sentence_rules_dont?: string[];
    structural_patterns?: StructuralPattern[];
    recurring_themes?: string[];
    example_passages?: ExamplePassage[];
    system_prompt_override?: string;
    methodology?: string;
    tone_authority?: string;
    tone_brand_loyalty?: number;
    seo_heading_style?: string;
    seo_meta_tone?: string;
    seo_article_length_min?: number;
    seo_article_length_max?: number;
    is_builtin?: boolean;
    builtin_slug?: string;
    badges?: string[];
    // Blog specific
    model_override?: string;
    image_style?: string;
    seo_outbound_links?: number;
    seo_internal_links?: number;
    seo_link_placement?: string;
    seo_keyword_density?: number;
    seo_keyword_placement_rules?: string;
    seo_heading_depth?: number;
    seo_include_faq: boolean;
    seo_include_toc: boolean;
    seo_meta_description_length?: number;
    seo_title_tag_format?: string;
    seo_ahrefs_min_volume?: number;
    seo_ahrefs_max_difficulty?: number;
    seo_ahrefs_country?: string;
    archived: boolean;
    created_at: string;
};

export type Article = {
    id: string;
    organization_id: string;
    campaign_id?: string;
    title?: string;
    body?: string;
    meta_title?: string;
    meta_description?: string;
    persona_id?: string;
    website_id?: string;
    format?: string;
    word_count: number;
    primary_keyword?: string;
    secondary_keywords?: string[];
    model_used?: string;
    prompt_snapshot?: string;
    seo_score: number;
    seo_audit_snapshot?: Record<string, unknown>;
    cross_site_links_snapshot?: Record<string, unknown>;
    external_seo_score?: number;
    featured_image_url?: string;
    source_article_url?: string;
    source_article_title?: string;
    source_article_publication?: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed';
    scheduled_at?: string;
    published_at?: string;
    external_post_id?: string;
    mcp_publish_log?: Record<string, unknown>;
    created_by?: string;
    approved_by?: string;
    created_at: string;
    updated_at: string;
};

export type UsageEvent = {
    id: string;
    organization_id: string;
    article_id?: string;
    user_id?: string;
    event_type: string;
    model_used?: string;
    estimated_cost_usd: number;
    created_at: string;
};

export type PersonaWritingSample = {
    id: string;
    persona_id: string;
    filename: string;
    storage_url: string;
    extracted_text?: string;
    uploaded_at: string;
};
