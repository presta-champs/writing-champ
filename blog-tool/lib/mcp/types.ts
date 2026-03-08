export type McpPlatform = "wordpress" | "prestashop" | "custom";

export type McpConnectionConfig = {
  serverUrl: string;
  authToken: string;
  platform: McpPlatform;
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
