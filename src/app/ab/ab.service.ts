import {
  ApplicationRef,
  Injectable,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AbContext, DEFAULT_EXPERIMENTS, EXPERIMENT_FEATURES, FeatureKey, bucket } from './features';

const AB_STATE = makeStateKey<AbContext>('ab');

/**
 * Variant decisions for this visitor.
 *
 * server mode: decisions come from the request context (set in server.ts by the SDK);
 * TransferState hands the same decisions to the browser, so hydration renders exactly
 * what the server rendered.
 *
 * browser mode (configuration D, SDK in the browser): the server renders control. Once
 * Angular has hydrated, a browser SDK decides (after fk_sdk_delay ms, standing in for
 * initialize() fetching its configuration) and Angular re-renders the variant.
 */
@Injectable({ providedIn: 'root' })
export class AbService {
  private readonly context: AbContext;
  private readonly variations = signal<AbContext['variations']>({});

  constructor() {
    const transferState = inject(TransferState);
    const requestContext = inject(REQUEST_CONTEXT, { optional: true }) as AbContext | null;
    if (requestContext) transferState.set(AB_STATE, requestContext);
    this.context = transferState.get(AB_STATE, { mode: 'client', variations: {} });
    this.variations.set(this.context.variations);

    if (this.context.mode === 'browser' && isPlatformBrowser(inject(PLATFORM_ID))) {
      // Deciding during hydration would make the browser render differently from the
      // server (a hydration mismatch), so the browser SDK waits until hydration is done.
      inject(ApplicationRef)
        .whenStable()
        .then(() => setTimeout(() => this.variations.set(decideInBrowser()), browserSettings().sdkDelay));
    }
  }

  get mode(): AbContext['mode'] {
    return this.context.mode;
  }

  get skipHydration(): boolean {
    return !!this.context.skipHydration;
  }

  isOn(feature: FeatureKey): boolean {
    return this.variations()[feature] === 'on';
  }
}

/** Settings written by public/fake-kameleoon.js for this tab. */
function browserSettings(): { variant: string; exp: string; sdkDelay: number } {
  let saved: Record<string, string> = {};
  try {
    saved = JSON.parse(sessionStorage.getItem('fk_settings') ?? '{}');
  } catch {}
  return {
    variant: saved['variant'] ?? '',
    exp: saved['exp'] || DEFAULT_EXPERIMENTS,
    sdkDelay: Number(saved['sdk_delay'] ?? 200) || 0,
  };
}

/** What a browser SDK's getVariation() would return for each experiment. */
function decideInBrowser(): AbContext['variations'] {
  const { variant, exp } = browserSettings();
  const code = document.cookie.match(/(?:^|; )fk_visitor=([^;]+)/)?.[1] ?? '';
  const chosen = variant === 'A' || variant === 'B' ? variant : bucket(code);
  const variations: AbContext['variations'] = {};
  for (const id of exp.split(',')) {
    const key = EXPERIMENT_FEATURES[id];
    if (key) variations[key] = chosen === 'B' ? 'on' : 'off';
  }
  return variations;
}
