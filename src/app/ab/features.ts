/** Feature flag keys, one per experiment in public/fake-kameleoon.js. */
export const FEATURES = {
  heroHeadline: 'hero_headline', // E1
  pdpDiscount: 'pdp_discount', // E2
  cardBadge: 'card_badge', // E3
  popularOrder: 'popular_order', // E4
  cartMessage: 'cart_message', // E5
  heroCta: 'hero_cta', // E6
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const EXPERIMENT_FEATURES: Record<string, FeatureKey> = {
  E1: FEATURES.heroHeadline,
  E2: FEATURES.pdpDiscount,
  E3: FEATURES.cardBadge,
  E4: FEATURES.popularOrder,
  E5: FEATURES.cartMessage,
  E6: FEATURES.heroCta,
};

/** Same default as the client script, so both modes run the same experiments. */
export const DEFAULT_EXPERIMENTS = 'E1,E2,E5,E6';

/**
 * What the server decided for this request.
 * client: the variant is applied by the client-side script (Angular renders control).
 * server: the SDK chose the variant on the server and Angular renders it.
 */
export interface AbContext {
  mode: 'client' | 'server' | 'browser';
  variations: Partial<Record<FeatureKey, string>>;
  /** Render "Popular products" with ngSkipHydration (configuration C). */
  skipHydration?: boolean;
}

/** Same bucketing as the client script and the fake server SDK. */
export function bucket(visitorCode: string): 'A' | 'B' {
  let hash = 0;
  for (let i = 0; i < visitorCode.length; i++) hash = (hash * 31 + visitorCode.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 ? 'B' : 'A';
}
