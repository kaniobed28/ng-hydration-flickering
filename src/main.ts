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
    .catch((err) => console.error(err));
}, slowDeviceDelay());
