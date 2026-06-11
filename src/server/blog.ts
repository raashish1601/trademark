import "server-only";
import sanitizeHtml from "sanitize-html";
import { serverEnv } from "./env";

/** Comma-separated admin emails (e.g. raashish1601@gmail.com). */
export function adminEmails(): string[] {
  return serverEnv.adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | undefined | null): boolean {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

/**
 * Sanitizes user-submitted rich text to exactly the TipTap vocabulary.
 * Critical: blog content is rendered with dangerouslySetInnerHTML, so anything
 * not on this allowlist (scripts, event handlers, iframes, styles) is stripped.
 */
export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "strong", "em", "s", "h2", "h3", "ul", "ol", "li",
      "blockquote", "code", "pre", "a", "img",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "loading"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // Only allow data: URLs for images (our compressed inline charts).
    allowedSchemesByTag: { img: ["https", "http", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
    // Cap inline image payload to keep rows sane (~600KB of base64).
    exclusiveFilter: (frame) =>
      frame.tag === "img" && (frame.attribs.src?.length ?? 0) > 600_000,
  });
}

/** Plain-text excerpt + length for validation. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "post"}-${Math.random().toString(36).slice(2, 7)}`;
}
