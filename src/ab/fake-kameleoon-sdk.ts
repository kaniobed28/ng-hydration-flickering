import type { Request, Response } from 'express';

/**
 * Fake Kameleoon Node.js SDK.
 *
 * Mirrors the parts of @kameleoon/nodejs-sdk's KameleoonClient we use (initialize,
 * getVisitorCode, getVariation) so the real client can replace it with few changes.
 * It buckets with the same cookie and hash as public/fake-kameleoon.js, so a visitor
 * lands in the same variant whichever mode is on.
 */

export const VISITOR_COOKIE = 'fk_visitor';

export interface Variation {
  /** Feature flag variation key: 'off' is control (A), 'on' is the variant (B). */
  key: 'off' | 'on';
  variables: Map<string, { key: string; value: unknown }>;
}

export class FakeKameleoonClient {
  private ready = false;

  constructor(readonly options: { siteCode: string }) {}

  /** The real SDK downloads the experiment configuration here. */
  async initialize(): Promise<boolean> {
    this.ready = true;
    return true;
  }

  /** Reads the visitor code cookie, or creates one and sets it on the response. */
  getVisitorCode({ request, response }: { request: Request; response: Response }): string {
    const existing = readCookie(request, VISITOR_COOKIE);
    if (existing) return existing;

    const code = Math.random().toString(36).slice(2, 12);
    response.cookie(VISITOR_COOKIE, code, { path: '/', maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax' });
    return code;
  }

  getVariation({ visitorCode, featureKey }: { visitorCode: string; featureKey: string }): Variation {
    if (!this.ready) throw new Error(`FakeKameleoonClient not initialized (feature ${featureKey})`);
    return { key: bucket(visitorCode) === 'B' ? 'on' : 'off', variables: new Map() };
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const match = (request.headers.cookie ?? '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Same hash as getVariant() in public/fake-kameleoon.js. */
function bucket(visitorCode: string): 'A' | 'B' {
  let hash = 0;
  for (let i = 0; i < visitorCode.length; i++) hash = (hash * 31 + visitorCode.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 ? 'B' : 'A';
}
