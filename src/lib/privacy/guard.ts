import type { LeaseDocument } from "@/types/lease";
import { isResearchTopicId, SUPPORTED_JURISDICTIONS } from "@/lib/research/topics";

/**
 * Client-side pre-send guard. Runs before every research request leaves the
 * browser. A payload passes only if:
 *   1. it has exactly the keys topicId and jurisdiction,
 *   2. both values are allowlisted constants, and
 *   3. no value contains any 12+ character run of the loaded lease's text.
 * (3) is redundant given (1)–(2) — by design. Defense in depth.
 */
export function checkOutgoingPayload(
  payload: Record<string, unknown>,
  doc: LeaseDocument | null,
): { ok: true } | { ok: false; reason: string } {
  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== "jurisdiction" || keys[1] !== "topicId") {
    return { ok: false, reason: "Payload contains fields other than topicId and jurisdiction." };
  }
  if (!isResearchTopicId(payload.topicId)) return { ok: false, reason: "Unknown research topic." };
  if (!(SUPPORTED_JURISDICTIONS as readonly unknown[]).includes(payload.jurisdiction)) {
    return { ok: false, reason: "Unsupported jurisdiction." };
  }
  if (doc && Object.values(payload).some((v) => containsDocumentText(String(v), doc))) {
    return { ok: false, reason: "Payload appears to contain lease text." };
  }
  return { ok: true };
}

const WINDOW = 12;

export function containsDocumentText(value: string, doc: LeaseDocument): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const v = norm(value);
  if (v.length < WINDOW) return false;
  const docText = norm(doc.pages.map((p) => p.text).join(" "));
  for (let i = 0; i + WINDOW <= v.length; i++) {
    const chunk = v.slice(i, i + WINDOW);
    // Skip chunks that are pure JSON punctuation / identifiers we control.
    if (!/[a-z0-9]{4,}/.test(chunk)) continue;
    if (docText.includes(chunk)) return true;
  }
  return false;
}
