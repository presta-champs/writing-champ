export type McpPlatform = "wordpress" | "prestashop" | "custom";

export type FieldMapping = {
  title?: string;           // default: "title"
  content?: string;         // default: "content"
  slug?: string;            // default: "slug"
  excerpt?: string;         // default: "excerpt"
  status?: string;          // default: "status"
  meta_title?: string;      // default: "meta_title"
  meta_description?: string; // default: "meta_description"
  date?: string;            // default: "date"
};

export const FIELD_MAPPING_DEFAULTS: Required<FieldMapping> = {
  title: "title",
  content: "content",
  slug: "slug",
  excerpt: "excerpt",
  status: "status",
  meta_title: "meta_title",
  meta_description: "meta_description",
  date: "date",
};

export type McpConnectionConfig = {
  serverUrl: string;
  authToken: string;
  platform: McpPlatform;
  fieldMapping?: FieldMapping;
};

export type McpTestResult = {
  success: boolean;
  message: string;
  siteName?: string;
  postsCount?: number;
};

export type McpPost = {
  id: string | number;
  title: string;
  url: string;
  slug: string;
  excerpt?: string;
  status: string;
  date?: string;
};

export type McpPublishPayload = {
  title: string;
  content: string;
  status: "draft" | "publish" | "future";
  slug?: string;
  excerpt?: string;
  meta_title?: string;
  meta_description?: string;
  featured_image_url?: string;
  date?: string; // ISO 8601 for scheduled posts
  categories?: string[];
  tags?: string[];
};

export type McpPublishResult = {
  success: boolean;
  externalPostId?: string;
  postUrl?: string;
  error?: string;
};

export type McpContentIndexResult = {
  posts: McpPost[];
  total: number;
  hasMore: boolean;
};
