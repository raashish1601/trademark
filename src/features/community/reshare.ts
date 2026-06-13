/**
 * Quote post / reshare — pure, framework-free logic.
 *
 * A reshare (or quote) is a NEW post whose `quotePostId` points at the ORIGINAL.
 * A plain reshare has an empty body; a quote carries the resharer's commentary.
 * Reshares never nest: resharing a reshare collapses to its root original so the
 * embedded chain is always exactly one level deep (no reshare-of-a-reshare-of…).
 *
 * This module never imports React or the DB so it can be unit-tested and reused
 * on the server.
 */

/** Max length of the optional commentary on a quote (matches the post body cap). */
export const QUOTE_BODY_MAX = 5000;

/**
 * Given the target the user clicked "reshare" on, returns the id that the new
 * reshare must reference. If the target is itself a reshare/quote (it has its
 * own `quotePostId`), we collapse to that root so chains never form; otherwise
 * the target IS the root and we reference it directly.
 *
 * @param targetId          the post the user is resharing
 * @param targetQuotePostId the target's own quote_post_id (null for an original)
 */
export function resolveReshareTarget(
  targetId: string,
  targetQuotePostId: string | null | undefined
): string {
  return targetQuotePostId ?? targetId;
}

/**
 * Normalizes the commentary on a quote. A plain reshare stores an empty body;
 * trimming a whitespace-only commentary down to "" turns an accidental quote
 * into a plain reshare (which is the right, least-surprising behavior).
 */
export function normalizeQuoteBody(body: string | null | undefined): string {
  return (body ?? "").trim().slice(0, QUOTE_BODY_MAX);
}

/** True when the post is a reshare/quote of another post. */
export function isReshare(post: { quotePostId?: string | null }): boolean {
  return Boolean(post.quotePostId);
}

/** "1 reshare" / "4 reshares" — count label for the post footer. */
export function reshareCountLabel(n: number): string {
  return `${n} ${n === 1 ? "reshare" : "reshares"}`;
}
