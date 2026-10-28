# ng-hydration-flickering

A small Angular store (SSR + hydration) for testing why client-side A/B tools like Kameleoon cause flicker,
and whether choosing the variant on the server with an SDK fixes it.

Nothing here talks to the real Kameleoon. Both sides are fakes that behave like the real thing:

| | Client script | Server SDK |
|---|---|---|
| File | [`public/fake-kameleoon.js`](public/fake-kameleoon.js) | [`src/ab/fake-kameleoon-sdk.ts`](src/ab/fake-kameleoon-sdk.ts) |
| Behaves like | The Kameleoon tag + visual editor | `@kameleoon/nodejs-sdk` (`getVisitorCode`, `getVariation`) |
| Who changes the page | The script, in the browser, after the server HTML arrives | Angular, on the server, before the HTML is sent |

## Run it

Needs Node 22+.

```bash
npm install
npm run build
npm run serve:ssr:ng-hydration
```

Open http://localhost:4000/lab.

After changing code, run `npm run build` again and restart the server.

## Test it yourself

The **A/B Lab** page (link at the top of every page) lists every test. Each one has two buttons:
**Run with client script** and **Run with server SDK**. It also tells you what to watch and what you should see.
Run both and compare.

| Test | What goes wrong with the client script |
|---|---|
| E2 Price | The price changes back and forth while the page loads |
| E1 Headline | The original headline shows, then jumps to the new one |
| E5 Cart message | The change disappears as soon as you click "Add to cart" |
| E6 Button | Clicking reloads the whole page and empties the cart |
| E7 Navigation | The original version shows briefly on every page change |
| E3+E4 Badges/order | Angular crashes while starting, a product shows twice |
| Anti-flicker | No flicker, but a blank page while waiting |

The black panel in the corner shows what happened and when:

- **flickers**: visible changes after the page appeared. The server SDK should always show 0.
- **CLS**: how much the layout jumped (Google's layout-shift score; above 0.1 is "poor").
- Green lines: the script changed the page. Red: Angular undid a change, or an error. Blue: Angular events.
- Buttons let you change one setting at a time. **slow device** starts Angular 1.5 s late, so the flicker is
  easy to see by eye. Without it, localhost is very fast; Chrome DevTools → Performance → CPU slowdown also works.

### Settings in the URL

Every panel setting can also be set in the URL, e.g.
`/product/te-6-22?fk_mode=client&fk_variant=B&fk_reapply=1&fk_slow=1500`.
The full list is at the top of [`public/fake-kameleoon.js`](public/fake-kameleoon.js).
Settings are remembered for the browser tab; `reset` in the panel clears them.

## How the server SDK version works

1. [`src/server.ts`](src/server.ts) reads the visitor cookie and asks the SDK for each experiment:
   `getVariation({ visitorCode, featureKey: 'pdp_discount' })` → `on` (B) or `off` (A).
2. It passes the answers into Angular for that request.
3. Components ask [`AbService`](src/app/ab/ab.service.ts): `ab.isOn('pdp_discount')` and render that version.
4. The answers are sent to the browser with the page (Angular `TransferState`), so when Angular starts in the
   browser it renders the same version, and nothing on screen changes.

The experiments themselves are in the templates, for example the price in
[`product-detail.ts`](src/app/pages/product-detail.ts) and the headline in [`home.ts`](src/app/pages/home.ts).
Feature keys are in [`features.ts`](src/app/ab/features.ts).

## Things to decide before using the real SDK

- **No visual editor.** With the SDK, developers build each variant in code; Kameleoon only decides A or B.
- **Caching.** If a CDN caches pages, it must keep A and B apart (for example by the variant cookie),
  or everyone gets whichever version was cached first.
- **Conversions** (clicks, purchases) still have to be reported to Kameleoon, from the server with the SDK
  or from the browser with their JS SDK.
- **Swapping in the real SDK:** install `@kameleoon/nodejs-sdk`, replace `FakeKameleoonClient` in
  `server.ts` with `KameleoonClient` (site code + credentials), and create feature flags in Kameleoon with the
  keys from `features.ts`. Check method names against the SDK version you install.
