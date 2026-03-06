import type {
  McpConnectionConfig,
  McpTestResult,
  McpPublishPayload,
  McpPublishResult,
  McpContentIndexResult,
  McpPost,
} from "./types";

/**
 * Unified MCP client that routes to the correct CMS adapter
 * based on platform_type.
 */
export class McpClient {
  private config: McpConnectionConfig;

  constructor(config: McpConnectionConfig) {
    this.config = config;
  }

  /** Test if the CMS connection is reachable and authenticated. */
  async testConnection(): Promise<McpTestResult> {
    switch (this.config.platform) {
      case "wordpress":
        return this.wpTest();
      case "prestashop":
        return this.psTest();
      case "custom":
        return this.customTest();
    }
  }

  /** Fetch published posts for the content index. */
  async fetchContentIndex(
    page = 1,
    perPage = 100
  ): Promise<McpContentIndexResult> {
    switch (this.config.platform) {
      case "wordpress":
        return this.wpFetchPosts(page, perPage);
      case "prestashop":
        return this.psFetchPosts(page, perPage);
      case "custom":
        return this.customFetchPosts(page, perPage);
    }
  }

  /** Publish or update a post on the CMS. */
  async publish(payload: McpPublishPayload): Promise<McpPublishResult> {
    switch (this.config.platform) {
      case "wordpress":
        return this.wpPublish(payload);
      case "prestashop":
        return this.psPublish(payload);
      case "custom":
        return this.customPublish(payload);
    }
  }

  /** Update an existing post on the CMS. */
  async updatePost(
    externalPostId: string,
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    switch (this.config.platform) {
      case "wordpress":
        return this.wpUpdate(externalPostId, payload);
      case "prestashop":
        return this.psUpdate(externalPostId, payload);
      case "custom":
        return this.customUpdate(externalPostId, payload);
    }
  }

  // ── WordPress REST API ───────────────────────────────────────────

  private wpApiUrl(path: string): string {
    const base = this.config.serverUrl.replace(/\/+$/, "");
    return `${base}/wp-json/wp/v2${path}`;
  }

  private wpHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.config.authToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async wpTest(): Promise<McpTestResult> {
    try {
      // Try users/me to verify authentication
      const res = await fetch(this.wpApiUrl("/users/me"), {
        headers: this.wpHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        // Try with Basic auth (application passwords)
        const basicRes = await fetch(this.wpApiUrl("/users/me"), {
          headers: {
            ...this.wpHeaders(),
            Authorization: `Basic ${Buffer.from(this.config.authToken).toString("base64")}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!basicRes.ok) {
          return {
            success: false,
            message: `Authentication failed (${res.status}). Check your application password or JWT token.`,
          };
        }
      }

      // Get site info
      const siteRes = await fetch(
        this.config.serverUrl.replace(/\/+$/, "") + "/wp-json",
        { signal: AbortSignal.timeout(10000) }
      );
      const siteInfo = siteRes.ok ? await siteRes.json() : null;

      // Get post count
      const postsRes = await fetch(this.wpApiUrl("/posts?per_page=1"), {
        headers: this.wpHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      const totalPosts = postsRes.headers.get("X-WP-Total");

      return {
        success: true,
        message: "Connected to WordPress successfully.",
        siteName: siteInfo?.name || undefined,
        postsCount: totalPosts ? parseInt(totalPosts) : undefined,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : "Failed to connect to WordPress",
      };
    }
  }

  private async wpFetchPosts(
    page: number,
    perPage: number
  ): Promise<McpContentIndexResult> {
    const url = this.wpApiUrl(
      `/posts?status=publish&per_page=${perPage}&page=${page}&_fields=id,title,link,slug,excerpt,status,date`
    );
    const res = await fetch(url, {
      headers: this.wpHeaders(),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`WordPress API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const total = parseInt(res.headers.get("X-WP-Total") || "0");
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");

    const posts: McpPost[] = data.map(
      (p: {
        id: number;
        title: { rendered: string };
        link: string;
        slug: string;
        excerpt: { rendered: string };
        status: string;
        date: string;
      }) => ({
        id: String(p.id),
        title: stripHtml(p.title.rendered),
        url: p.link,
        slug: p.slug,
        excerpt: stripHtml(p.excerpt.rendered).slice(0, 300) || undefined,
        status: p.status,
        date: p.date,
      })
    );

    return {
      posts,
      total,
      hasMore: page < totalPages,
    };
  }

  private async wpPublish(payload: McpPublishPayload): Promise<McpPublishResult> {
    const wpPayload: Record<string, unknown> = {
      title: payload.title,
      content: payload.content,
      status: payload.status,
    };

    if (payload.slug) wpPayload.slug = payload.slug;
    if (payload.excerpt) wpPayload.excerpt = payload.excerpt;
    if (payload.date) wpPayload.date = payload.date;

    // Yoast SEO meta (if Yoast is installed)
    if (payload.meta_title || payload.meta_description) {
      wpPayload.meta = {
        ...(payload.meta_title && { _yoast_wpseo_title: payload.meta_title }),
        ...(payload.meta_description && {
          _yoast_wpseo_metadesc: payload.meta_description,
        }),
      };
    }

    const res = await fetch(this.wpApiUrl("/posts"), {
      method: "POST",
      headers: this.wpHeaders(),
      body: JSON.stringify(wpPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return {
        success: false,
        error: error.message || `WordPress error: ${res.status}`,
      };
    }

    const created = await res.json();
    return {
      success: true,
      externalPostId: String(created.id),
      postUrl: created.link,
    };
  }

  private async wpUpdate(
    postId: string,
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    const wpPayload: Record<string, unknown> = {
      title: payload.title,
      content: payload.content,
      status: payload.status,
    };

    if (payload.slug) wpPayload.slug = payload.slug;
    if (payload.excerpt) wpPayload.excerpt = payload.excerpt;

    if (payload.meta_title || payload.meta_description) {
      wpPayload.meta = {
        ...(payload.meta_title && { _yoast_wpseo_title: payload.meta_title }),
        ...(payload.meta_description && {
          _yoast_wpseo_metadesc: payload.meta_description,
        }),
      };
    }

    const res = await fetch(this.wpApiUrl(`/posts/${postId}`), {
      method: "PUT",
      headers: this.wpHeaders(),
      body: JSON.stringify(wpPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return {
        success: false,
        error: error.message || `WordPress error: ${res.status}`,
      };
    }

    const updated = await res.json();
    return {
      success: true,
      externalPostId: String(updated.id),
      postUrl: updated.link,
    };
  }

  // ── PrestaShop REST API ──────────────────────────────────────────

  private psApiUrl(path: string): string {
    const base = this.config.serverUrl.replace(/\/+$/, "");
    return `${base}/api${path}`;
  }

  private psHeaders(): HeadersInit {
    return {
      Authorization: `Basic ${Buffer.from(this.config.authToken + ":").toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Output-Format": "JSON",
    };
  }

  private async psTest(): Promise<McpTestResult> {
    try {
      const res = await fetch(this.psApiUrl("/"), {
        headers: this.psHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          success: false,
          message: `PrestaShop authentication failed (${res.status}).`,
        };
      }

      return {
        success: true,
        message: "Connected to PrestaShop successfully.",
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to connect to PrestaShop",
      };
    }
  }

  private async psFetchPosts(
    page: number,
    perPage: number
  ): Promise<McpContentIndexResult> {
    // PrestaShop uses CMS pages for blog-like content
    const offset = (page - 1) * perPage;
    const url = this.psApiUrl(
      `/cms?display=[id,meta_title,link_rewrite,meta_description]&limit=${offset},${perPage}&output_format=JSON`
    );

    const res = await fetch(url, {
      headers: this.psHeaders(),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`PrestaShop API error: ${res.status}`);
    }

    const data = await res.json();
    const cmsPages = data.cms || [];
    const siteBase = this.config.serverUrl.replace(/\/+$/, "");

    const posts: McpPost[] = cmsPages.map(
      (p: {
        id: number;
        meta_title: string;
        link_rewrite: string;
        meta_description: string;
      }) => ({
        id: String(p.id),
        title: p.meta_title,
        url: `${siteBase}/content/${p.id}-${p.link_rewrite}`,
        slug: p.link_rewrite,
        excerpt: p.meta_description || undefined,
        status: "publish",
      })
    );

    return {
      posts,
      total: posts.length,
      hasMore: posts.length === perPage,
    };
  }

  private async psPublish(
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    const psPayload = {
      cms: {
        id_cms_category: 1,
        active: payload.status === "publish" ? 1 : 0,
        content: [{ language: { attrs: { id: 1 }, value: payload.content } }],
        meta_title: [
          {
            language: {
              attrs: { id: 1 },
              value: payload.meta_title || payload.title,
            },
          },
        ],
        meta_description: [
          {
            language: {
              attrs: { id: 1 },
              value: payload.meta_description || "",
            },
          },
        ],
        link_rewrite: [
          {
            language: {
              attrs: { id: 1 },
              value:
                payload.slug ||
                payload.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, ""),
            },
          },
        ],
      },
    };

    const res = await fetch(this.psApiUrl("/cms"), {
      method: "POST",
      headers: this.psHeaders(),
      body: JSON.stringify(psPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `PrestaShop error: ${res.status}`,
      };
    }

    const created = await res.json();
    const postId = created.cms?.id;

    return {
      success: true,
      externalPostId: postId ? String(postId) : undefined,
      postUrl: postId
        ? `${this.config.serverUrl.replace(/\/+$/, "")}/content/${postId}`
        : undefined,
    };
  }

  private async psUpdate(
    postId: string,
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    const psPayload = {
      cms: {
        id: parseInt(postId),
        active: payload.status === "publish" ? 1 : 0,
        content: [{ language: { attrs: { id: 1 }, value: payload.content } }],
        meta_title: [
          {
            language: {
              attrs: { id: 1 },
              value: payload.meta_title || payload.title,
            },
          },
        ],
        meta_description: [
          {
            language: {
              attrs: { id: 1 },
              value: payload.meta_description || "",
            },
          },
        ],
      },
    };

    const res = await fetch(this.psApiUrl(`/cms/${postId}`), {
      method: "PUT",
      headers: this.psHeaders(),
      body: JSON.stringify(psPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `PrestaShop error: ${res.status}`,
      };
    }

    return {
      success: true,
      externalPostId: postId,
    };
  }

  // ── Custom/Webhook ───────────────────────────────────────────────

  private async customTest(): Promise<McpTestResult> {
    try {
      const res = await fetch(this.config.serverUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.authToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Custom endpoint returned ${res.status}.`,
        };
      }

      return {
        success: true,
        message: "Custom CMS endpoint is reachable.",
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to connect to custom endpoint",
      };
    }
  }

  private async customFetchPosts(
    page: number,
    perPage: number
  ): Promise<McpContentIndexResult> {
    const url = new URL(this.config.serverUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") + "/posts";
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Custom API error: ${res.status}`);
    }

    const data = await res.json();
    const posts: McpPost[] = (data.posts || data || []).map(
      (p: Record<string, unknown>) => ({
        id: String(p.id),
        title: String(p.title || ""),
        url: String(p.url || p.link || ""),
        slug: String(p.slug || ""),
        excerpt: p.excerpt ? String(p.excerpt) : undefined,
        status: String(p.status || "publish"),
        date: p.date ? String(p.date) : undefined,
      })
    );

    return {
      posts,
      total: (data.total as number) || posts.length,
      hasMore: (data.hasMore as boolean) || posts.length === perPage,
    };
  }

  private async customPublish(
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    const url = new URL(this.config.serverUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") + "/posts";

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { success: false, error: `Custom API error: ${res.status} ${err}` };
    }

    const data = await res.json();
    return {
      success: true,
      externalPostId: data.id ? String(data.id) : undefined,
      postUrl: data.url || data.link || undefined,
    };
  }

  private async customUpdate(
    postId: string,
    payload: McpPublishPayload
  ): Promise<McpPublishResult> {
    const url = new URL(this.config.serverUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") + `/posts/${postId}`;

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.config.authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { success: false, error: `Custom API error: ${res.status} ${err}` };
    }

    const data = await res.json();
    return {
      success: true,
      externalPostId: postId,
      postUrl: data.url || data.link || undefined,
    };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}
