"use client";

import { useSyncExternalStore } from "react";
import { getAuditEvents, subscribeAudit, type AuditEvent } from "@/lib/privacy/audit";

const EMPTY: AuditEvent[] = [];

export function useAuditEvents(): AuditEvent[] {
  return useSyncExternalStore(subscribeAudit, getAuditEvents, () => EMPTY);
}

export interface ObservedRequest {
  url: string;
  origin: string;
  path: string;
  initiatorType: string;
}

/*
 * Network requests made by this page, as reported by the browser's Resource
 * Timing API (fetch, XHR, scripts, styles, images, workers). It does not see
 * requests made by browser extensions or other tabs.
 */
const NO_REQUESTS: ObservedRequest[] = [];
let observed: ObservedRequest[] = NO_REQUESTS;
let started = false;
const listeners = new Set<() => void>();

function isSupported(): boolean {
  return typeof PerformanceObserver !== "undefined" && Boolean(PerformanceObserver.supportedEntryTypes?.includes("resource"));
}

function toRequest(e: PerformanceEntry): ObservedRequest | null {
  try {
    const u = new URL(e.name);
    if (u.protocol === "data:" || u.protocol === "blob:") return null;
    return { url: e.name, origin: u.origin, path: u.pathname, initiatorType: (e as PerformanceResourceTiming).initiatorType };
  } catch {
    return null;
  }
}

function start() {
  if (started || !isSupported()) return;
  started = true;
  observed = performance.getEntriesByType("resource").map(toRequest).filter((r): r is ObservedRequest => r !== null);
  new PerformanceObserver((list) => {
    const add = list.getEntries().map(toRequest).filter((r): r is ObservedRequest => r !== null);
    if (!add.length) return;
    observed = [...observed, ...add];
    listeners.forEach((l) => l());
  }).observe({ type: "resource", buffered: false });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useObservedRequests(): { supported: boolean; requests: ObservedRequest[] } {
  const requests = useSyncExternalStore(subscribe, () => observed, () => NO_REQUESTS);
  return { supported: typeof window === "undefined" ? true : isSupported(), requests };
}
