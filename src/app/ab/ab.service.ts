import { Injectable, REQUEST_CONTEXT, TransferState, inject, makeStateKey } from '@angular/core';
import { AbContext, FeatureKey } from './features';

const AB_STATE = makeStateKey<AbContext>('ab');

/**
 * Variant decisions for this visitor. On the server they come from the request context
 * (set in server.ts by the SDK); TransferState hands the same decisions to the browser,
 * so hydration renders exactly what the server rendered.
 */
@Injectable({ providedIn: 'root' })
export class AbService {
  private readonly context: AbContext;

  constructor() {
    const transferState = inject(TransferState);
    const requestContext = inject(REQUEST_CONTEXT, { optional: true }) as AbContext | null;
    if (requestContext) transferState.set(AB_STATE, requestContext);
    this.context = transferState.get(AB_STATE, { mode: 'client', variations: {} });
  }

  isOn(feature: FeatureKey): boolean {
    return this.context.variations[feature] === 'on';
  }
}
