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
    page: '/product/rh-22',
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
    page: '/product/rh-22',
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
    steps: 'Scroll to "Popular products" and click "RH 22 Cordless Rotary Hammer".',
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

const PANEL_HELP: { title: string; items: { name: string; text: string }[] }[] = [
  {
    title: 'Scores (top line)',
    items: [
      { name: 'Variant B · server SDK', text: 'Which version you are seeing, and which way it was made.' },
      { name: 'flickers', text: 'How many times something visibly changed on screen after the page appeared. 0 is the goal.' },
      { name: 'CLS', text: 'How much the page jumped around (a Google score). Under 0.1 is good, above 0.1 is poor.' },
    ],
  },
  {
    title: 'Which way the test runs',
    items: [
      { name: 'client script', text: 'The way Kameleoon usually works: the page arrives in its original form, then a script in the browser edits it. This is the way that flickers.' },
      { name: 'server SDK', text: 'The alternative: our server decides the version first and sends a page that is already correct. Nothing edits it afterwards.' },
    ],
  },
  {
    title: 'Which version you see',
    items: [
      { name: 'Variant A', text: 'The original page, as it is today (also called "control").' },
      { name: 'Variant B', text: 'The new version we are testing. Choose B to see the changes, and the problems they cause.' },
      { name: 'neither on', text: 'After "reset", a cookie picks A or B at random, like it does for a real visitor.' },
    ],
  },
  {
    title: 'When the A/B script makes its change (client script only)',
    items: [
      { name: 'early', text: 'The script is fast: it changes the page before the website wakes up. The website then often undoes the change, or breaks.' },
      { name: 'late', text: 'The script is slow (slow network, tag manager): visitors first see the original, then it suddenly switches to the new version.' },
      { name: 're-apply', text: 'When the website undoes a change, the script puts it back, like real A/B tools do. This causes the back-and-forth effect.' },
      { name: 'anti-flicker', text: 'Hides the whole page until the script has made its changes. No flicker, but visitors stare at a blank page meanwhile.' },
    ],
  },
  {
    title: 'Which changes are being tested',
    items: [
      { name: 'E1', text: 'Home page: new headline and a red banner.' },
      { name: 'E2', text: 'Product page: price shown 10% cheaper.' },
      { name: 'E3', text: 'Product cards: a yellow "Free shipping" label.' },
      { name: 'E4', text: 'Home page: "Popular products" shown in reverse order.' },
      { name: 'E5', text: 'Header: "Free delivery over €100" instead of the cart total.' },
      { name: 'E6', text: 'Home page: a green "Get 20% off" button replaces the red one.' },
    ],
  },
  {
    title: 'Other',
    items: [
      { name: 'slow device', text: 'Pretends to be a slow phone: the website wakes up 1.5 seconds later. Problems that normally last a split second become easy to see.' },
      { name: 'reset', text: 'Puts every setting back to its starting value.' },
    ],
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

      <h2>The black panel, explained</h2>
      <p class="lead">
        The black box in the bottom-right corner of every page is the control panel for these tests. A yellow
        button is switched on. Clicking a button reloads the page with the new setting. Click the panel's title
        to fold it away.
      </p>
      <p class="lead">
        One idea helps with everything below: a page arrives in two steps. First the visitor sees it
        (like a picture). A moment later the website <strong>"wakes up"</strong> and becomes clickable. Most
        problems happen because the A/B tool and the waking-up website both try to control the same page.
      </p>

      <div class="glossary">
        @for (group of panelHelp; track group.title) {
          <section>
            <h3>{{ group.title }}</h3>
            <dl>
              @for (item of group.items; track item.name) {
                <dt><span class="chip">{{ item.name }}</span></dt>
                <dd>{{ item.text }}</dd>
              }
            </dl>
          </section>
        }
      </div>

      <h3>The list of events</h3>
      <p class="lead">
        Under the buttons, the panel lists what happened while the page loaded. The number on the left is the
        time in milliseconds (1000 ms = 1 second).
        <span class="c-apply">Green</span>: the A/B script changed the page.
        <span class="c-revert">Red</span>: a change was undone, or something broke.
        <span class="c-ng">Blue</span>: the website did something (for example "Angular hydrated" means it woke up).
      </p>

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
  protected readonly panelHelp = PANEL_HELP;

  protected link(s: Scenario, mode: Mode): string {
    const params = new URLSearchParams({ ...BASE_PARAMS, ...s.params, fk_mode: mode });
    return `${s.page}?${params}`;
  }

  protected visitorLink(mode: Mode): string {
    const params = new URLSearchParams({ ...BASE_PARAMS, fk_variant: '', fk_exp: 'E1,E2,E5,E6', fk_mode: mode });
    return `/?${params}`;
  }
}
