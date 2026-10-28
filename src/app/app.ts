import { Component, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './components/header';
import { Footer } from './components/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  template: `
    <app-header />
    <main>
      <router-outlet />
    </main>
    <app-footer />
  `,
})
export class App {
  constructor() {
    // Lets the A/B script's timeline show when Angular has taken over the server HTML.
    afterNextRender(() => {
      performance.mark('ng:hydrated');
      window.dispatchEvent(new Event('ng:hydrated'));
    });
  }
}
