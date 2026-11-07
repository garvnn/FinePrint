/**
 * SERVER-ONLY best-effort protections for /api/research.
 *
 * Both structures are per-instance memory. On serverless platforms each
 * instance has its own copy, so these are abuse speed-bumps, not guarantees.
 * Topic queries are generic (no user data), so caching them is privacy-safe.
 */
import type { ResearchResponse, ResearchTopicId } from "@/types/lease";

export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  /** Returns true if the request is allowed. */
  check(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.hits.clear();
    return true;
  }
}

export class TopicCache {
  private entries = new Map<ResearchTopicId, { at: number; value: ResearchResponse }>();
  constructor(private ttlMs: number) {}

  get(topicId: ResearchTopicId, now = Date.now()): ResearchResponse | null {
    const e = this.entries.get(topicId);
    if (!e || now - e.at > this.ttlMs) return null;
    return { ...e.value, cached: true };
  }

  set(topicId: ResearchTopicId, value: ResearchResponse, now = Date.now()) {
    if (value.status === "ok") this.entries.set(topicId, { at: now, value });
  }
}
