import { z } from "zod";
import { RESEARCH_TOPIC_IDS, SUPPORTED_JURISDICTIONS } from "./topics";
import type { Jurisdiction, ResearchTopicId } from "@/types/lease";

/**
 * The complete, strict request schema for POST /api/research.
 *
 * - Exactly two fields; any other field is rejected (`.strict()`).
 * - topicId must be one of the allowlisted IDs — free text is impossible.
 * - The serialized body is capped (see MAX_RESEARCH_BODY_BYTES) so a client
 *   cannot smuggle lease text in through oversized payloads.
 */
export const researchRequestSchema = z
  .object({
    topicId: z.enum(RESEARCH_TOPIC_IDS as [ResearchTopicId, ...ResearchTopicId[]]),
    jurisdiction: z.enum(SUPPORTED_JURISDICTIONS),
  })
  .strict();

export type ResearchRequest = { topicId: ResearchTopicId; jurisdiction: Jurisdiction };

/** Largest legitimate body is ~70 bytes; anything above this is rejected outright. */
export const MAX_RESEARCH_BODY_BYTES = 256;

export type ParseResult =
  | { ok: true; value: ResearchRequest }
  | { ok: false; status: 400 | 413 | 415; error: string };

/** Validate a raw request body string. Pure; used by the route and by tests. */
export function parseResearchRequest(rawBody: string, contentType: string | null): ParseResult {
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json." };
  }
  if (new TextEncoder().encode(rawBody).length > MAX_RESEARCH_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request body too large. Only a topic ID and jurisdiction are accepted." };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Body must be valid JSON." };
  }
  const parsed = researchRequestSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Invalid research request. Only an allowlisted topicId and jurisdiction \"MA\" are accepted.",
    };
  }
  return { ok: true, value: parsed.data };
}
