/**
 * Privacy audit log. A tiny in-memory event store (no persistence).
 *
 * Events are recorded by the code paths that actually do the work: the PDF
 * extractor, the analysis engine and the research client. The Privacy panel
 * renders this log, so every claim it makes is backed by a real event.
 */

export type AuditEvent =
  | {
      id: number;
      at: string;
      type: "local";
      step: "pdf_parse" | "analysis" | "costs" | "sample_fetch";
      detail: string;
    }
  | {
      id: number;
      at: string;
      type: "network";
      endpoint: string;
      /** The exact JSON body sent, as a string. */
      body: string;
      bytes: number;
      topicId: string;
      jurisdiction: string;
      /** Third-party service that the server forwards the generic query to. */
      forwardedTo: string;
      /** Result of the pre-send guard comparing the payload with the document. */
      leaseContentCheck: "passed" | "blocked";
      responseStatus: number | null;
      researchStatus: string | null;
    };

type Listener = () => void;

let events: AuditEvent[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

// Distributive Omit so each union member keeps its own fields.
type WithoutMeta<T> = T extends unknown ? Omit<T, "id" | "at"> : never;

export function recordAudit(event: WithoutMeta<AuditEvent>): number {
  const id = nextId++;
  events = [...events, { ...event, id, at: new Date().toISOString() } as AuditEvent];
  emit();
  return id;
}

export function updateAudit(id: number, patch: Partial<Extract<AuditEvent, { type: "network" }>>) {
  events = events.map((e) => (e.id === id && e.type === "network" ? { ...e, ...patch } : e));
  emit();
}

export function getAuditEvents(): AuditEvent[] {
  return events;
}

export function subscribeAudit(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearAudit() {
  events = [];
  emit();
}

export interface AuditSummary {
  localSteps: number;
  networkRequests: number;
  topicIds: string[];
  blockedRequests: number;
  leaseContentTransmitted: boolean;
}

export function summarizeAudit(list: AuditEvent[]): AuditSummary {
  const net = list.filter((e): e is Extract<AuditEvent, { type: "network" }> => e.type === "network");
  return {
    localSteps: list.filter((e) => e.type === "local").length,
    networkRequests: net.filter((e) => e.leaseContentCheck === "passed").length,
    topicIds: [...new Set(net.filter((e) => e.leaseContentCheck === "passed").map((e) => e.topicId))],
    blockedRequests: net.filter((e) => e.leaseContentCheck === "blocked").length,
    leaseContentTransmitted: false,
  };
}
