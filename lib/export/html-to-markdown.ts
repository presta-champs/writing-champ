/**
 * Lightweight HTML-to-Markdown converter.
 * Handles: headings, bold, italic, links, unordered/ordered lists,
 * blockquotes, paragraphs, line breaks, horizontal rules, code/pre.
 *
 * No external dependencies -- operates on a string using DOMParser
 * (client-side only).
 */

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  return convertNode(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    // Preserve text content, collapse internal whitespace but keep meaningful spaces
    return (node.textContent ?? "").replace(/[ \t]+/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Process children first
  const childrenText = () =>
    Array.from(el.childNodes)
      .map((c) => convertNode(c))
      .join("");

  switch (tag) {
    // --- Headings ---
    case "h1":
      return `\n\n# ${childrenText().trim()}\n\n`;
    case "h2":
      return `\n\n## ${childrenText().trim()}\n\n`;
    case "h3":
      return `\n\n### ${childrenText().trim()}\n\n`;
    case "h4":
      return `\n\n#### ${childrenText().trim()}\n\n`;
    case "h5":
      return `\n\n##### ${childrenText().trim()}\n\n`;
    case "h6":
      return `\n\n###### ${childrenText().trim()}\n\n`;

    // --- Inline formatting ---
    case "strong":
    case "b":
      return `**${childrenText().trim()}**`;
    case "em":
    case "i":
      return `*${childrenText().trim()}*`;
    case "code":
      return `\`${childrenText().trim()}\``;
    case "s":
    case "del":
    case "strike":
      return `~~${childrenText().trim()}~~`;

    // --- Links and images ---
    case "a": {
      const href = el.getAttribute("href") ?? "";
      const text = childrenText().trim();
      return `[${text}](${href})`;
    }
    case "img": {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      return `![${alt}](${src})`;
    }

    // --- Block elements ---
    case "p":
      return `\n\n${childrenText().trim()}\n\n`;
    case "br":
      return "  \n";
    case "hr":
      return "\n\n---\n\n";

    // --- Blockquotes ---
    case "blockquote": {
      const inner = childrenText().trim();
      const lines = inner.split("\n").map((l) => `> ${l}`);
      return `\n\n${lines.join("\n")}\n\n`;
    }

    // --- Lists ---
    case "ul":
      return `\n\n${convertList(el, "ul")}\n\n`;
    case "ol":
      return `\n\n${convertList(el, "ol")}\n\n`;
    case "li":
      // Handled by convertList -- fallback just in case
      return childrenText().trim();

    // --- Pre / code blocks ---
    case "pre": {
      const codeEl = el.querySelector("code");
      const content = codeEl
        ? codeEl.textContent ?? ""
        : el.textContent ?? "";
      return `\n\n\`\`\`\n${content.trim()}\n\`\`\`\n\n`;
    }

    // --- Table (basic) ---
    case "table":
      return convertTable(el);

    // --- Divs, spans, etc. -- pass through ---
    default:
      return childrenText();
  }
}

function convertList(el: HTMLElement, type: "ul" | "ol"): string {
  const items = Array.from(el.children).filter(
    (c) => c.tagName.toLowerCase() === "li"
  );

  return items
    .map((li, idx) => {
      const prefix = type === "ol" ? `${idx + 1}. ` : "- ";
      const content = Array.from(li.childNodes)
        .map((c) => {
          const t = (c as HTMLElement).tagName?.toLowerCase();
          if (t === "ul" || t === "ol") {
            // Nested list -- indent
            return "\n" + convertList(c as HTMLElement, t as "ul" | "ol")
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n");
          }
          return convertNode(c);
        })
        .join("")
        .trim();
      return `${prefix}${content}`;
    })
    .join("\n");
}

function convertTable(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const matrix = rows.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map(
      (cell) => (cell.textContent ?? "").trim()
    )
  );

  const colCount = Math.max(...matrix.map((r) => r.length));
  const normalized = matrix.map((r) => {
    while (r.length < colCount) r.push("");
    return r;
  });

  const header = `| ${normalized[0].join(" | ")} |`;
  const separator = `| ${normalized[0].map(() => "---").join(" | ")} |`;
  const body = normalized
    .slice(1)
    .map((r) => `| ${r.join(" | ")} |`)
    .join("\n");

  return `\n\n${header}\n${separator}\n${body}\n\n`;
}
