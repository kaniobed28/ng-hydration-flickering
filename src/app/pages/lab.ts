import { Component } from '@angular/core';

type Mode = 'client' | 'server';

interface Scenario {
  id: string;
  title: string;
  page: string;
  /** Overrides for this scenario; every other fk_ setting is reset to its default. */
  params: Record<string, string>;
  watch: string;
  steps?: string;
  client: string;
  server: string;
}

const BASE_PARAMS: Record<string, string> = {
  fk_variant: 'B',
  fk_timing: 'early',
  fk_delay: '1000',
  fk_reapply: '0',
  fk_reapply_delay: '300',
  fk_nav_delay: '400',
  fk_antiflicker: '0',
  fk_timeout: '2000',
  fk_slow: '0',
  fk_debug: '1',
};

const SCENARIOS: Scenario[] = [
  {
    id: 'E2',
    title: 'Price changes back and forth',
    page: '/product/te-6-22',
    params: { fk_exp: 'E2', fk_reapply: '1', fk_slow: '1500' },
    watch: 'The big price under the product name.',
    client: '€413.10 → €459.00 → €413.10. Angular puts the original price back when it starts, then the script changes it again.',
    server: '€413.10 the whole time.',
  },
  {
    id: 'E1',
    title: 'Slow script swaps the headline',
    page: '/',
    params: { fk_exp: 'E1', fk_timing: 'late', fk_delay: '1500' },
    watch: 'The big headline and the dark banner.',
    client: '"One battery. Every tool…" for 1.5 s, then it jumps to "Power through every job…" and the banner turns red.',
    server: 'The new headline and red banner from the first moment.',
  },
  {
    id: 'E5',
    title: 'Change disappears after a click',
    page: '/product/te-6-22',
    params: { fk_exp: 'E5', fk_timing: 'late', fk_delay: '300' },
    watch: 'The small text next to "Cart" in the red header.',
    steps: 'Wait 1 second, then click "Add to cart".',
    client: '"Free delivery over €100" is replaced by the cart total as soon as you click.',
    server: '"Free delivery over €100" stays.',
  },
  {
    id: 'E6',
    title: 'Button stops working properly',
    page: '/',
    params: { fk_exp: 'E6', fk_timing: 'late', fk_delay: '300' },
    watch: 'The cart count in the header, and the page while it changes.',
    steps: 'Click "Add to cart" on a product, then click the green "Get 20% off cordless" button.',
    client: 'The whole page reloads (white flash) and the cart goes back to 0.',
    server: 'Instant page change, the cart keeps your item.',
  },
  {
    id: 'E7',
    title: 'Flicker on every page change',
    page: '/',
    params: { fk_exp: 'E2', fk_nav_delay: '1000' },
    watch: 'The price on the product page you open.',
    steps: 'Scroll to "Popular products" and click "TE 6-22 Cordless Rotary Hammer".',
    client: '€459.00 for 1 s, then €413.10.',
    server: '€413.10 straight away.',
  },
  {
    id: 'E3+E4',
    title: 'Bigger changes break the page',
    page: '/',
    params: { fk_exp: 'E3,E4' },
    watch: '"Popular products": yellow "Free shipping" badges and the order of the cards. Red errors in the panel.',
    client: 'Angular crashes while starting: a product appears twice and most badges are missing.',
    server: '4 cards in reverse order, each with a badge, no errors.',
  },
  {
    id: 'Anti-flicker',
    title: 'Hiding the page until the script is ready',
    page: '/',
    params: { fk_exp: 'E1', fk_timing: 'late', fk_delay: '1500', fk_antiflicker: '1', fk_timeout: '3000' },
    watch: 'The whole page.',
    client: 'No flicker, but a blank page for 1.5 s on every visit.',
    server: 'Not needed: the page shows straight away with the new headline.',
  },
];

@Component({
  selector: 'app-lab',
  template: `
    <div class="container">
      <h1>A/B Lab</h1>
      <p class="lead">
        Each test opens a page in variant B, once with the client-side script (how a Kameleoon tag works today)
        and once with the server-side SDK. Compare what you see. Every button resets all settings, so tests don't
        affect each other.
      </p>

      <div class="how">
        <div>
          <h2>Client script</h2>
          <ol>
            <li>Server sends the original page (A).</li>
            <li>The A/B script edits the page in the browser (B).</li>
            <li>Angular starts and may put A back, or break.</li>
          </ol>
        </div>
        <div>
          <h2>Server SDK</h2>
          <ol>
            <li>Server asks the SDK: A or B?</li>
            <li>Angular builds the page already in B and sends it.</li>
            <li>Angular starts in the browser with the same answer. Nothing changes.</li>
          </ol>
        </div>
      </div>

      <h2>Tests</h2>
      <div class="scenarios">
        @for (s of scenarios; track s.id) {
          <article class="scenario">
            <header>
              <span class="tag">{{ s.id }}</span>
              <h3>{{ s.title }}</h3>
            </header>
            <p><strong>Watch:</strong> {{ s.watch }}</p>
            @if (s.steps) {
              <p><strong>Then:</strong> {{ s.steps }}</p>
            }
            <div class="compare">
              <div class="side side--client">
                <a class="btn" [href]="link(s, 'client')">Run with client script</a>
                <p>{{ s.client }}</p>
              </div>
              <div class="side side--server">
                <a class="btn" [href]="link(s, 'server')">Run with server SDK</a>
                <p>{{ s.server }}</p>
              </div>
            </div>
          </article>
        }
      </div>

      <h2>Reading the black panel</h2>
      <ul class="panel-help">
        <li><strong>flickers</strong>: how many times something visibly changed after the page appeared. Server SDK should stay at 0.</li>
        <li><strong>CLS</strong>: how much the layout jumped (Google's layout-shift score). Lower is better; above 0.1 is "poor".</li>
        <li><span class="c-apply">Green</span>: the script changed the page. <span class="c-revert">Red</span>: Angular undid a change, or an error.
          <span class="c-ng">Blue</span>: Angular events. The number on the left is milliseconds since the page started loading.</li>
        <li>Click the panel title to fold it away. Use its buttons to change one thing at a time (variant, client/server, early/late, slow device…).</li>
      </ul>

      <h2>Try as a real visitor</h2>
      <p>
        Real visitors aren't forced into B: a cookie puts each one in A or B at random.
        <a [href]="visitorLink('client')">Open as a random visitor (client script)</a> ·
        <a [href]="visitorLink('server')">Open as a random visitor (server SDK)</a>.
        The panel shows which variant you got. To be bucketed again, open it in a new private window.
      </p>
    </div>
  `,
  styleUrl: './lab.scss',
})
export class Lab {
  protected readonly scenarios = SCENARIOS;

  protected link(s: Scenario, mode: Mode): string {
    const params = new URLSearchParams({ ...BASE_PARAMS, ...s.params, fk_mode: mode });
    return `${s.page}?${params}`;
  }

  protected visitorLink(mode: Mode): string {
    const params = new URLSearchParams({ ...BASE_PARAMS, fk_variant: '', fk_exp: 'E1,E2,E5,E6', fk_mode: mode });
    return `/?${params}`;
  }
}
