import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Demo: simulate a slow device by starting Angular (and so hydration) later.
// Set by the "slow device" switch of public/fake-kameleoon.js.
function slowDeviceDelay(): number {
  try {
    return Number(JSON.parse(sessionStorage.getItem('fk_settings') ?? '{}').slow) || 0;
  } catch {
    return 0;
  }
}

setTimeout(() => {
  bootstrapApplication(App, appConfig)
    .then((appRef) => appRef.whenStable())
    .then(() => {
      // Tell scripts outside Angular that hydration is done and the app is stable,
      // like a production site that holds its A/B tool until then (fk_timing=stable).
      (window as unknown as { __ngStableAt?: number }).__ngStableAt = performance.now();
      window.dispatchEvent(new Event('ng-stable'));
    })
    .catch((err) => console.error(err));
}, slowDeviceDelay());
