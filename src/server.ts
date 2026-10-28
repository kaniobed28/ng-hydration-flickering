import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response } from 'express';
import { join } from 'node:path';
import { FakeKameleoonClient, readCookie } from './ab/fake-kameleoon-sdk';
import { AbContext, DEFAULT_EXPERIMENTS, EXPERIMENT_FEATURES } from './app/ab/features';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// On Vercel every request comes through its proxy, which adds these headers. Untrusted
// x-forwarded-* headers make Angular skip SSR and serve an empty client-rendered page.
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port'],
});

// One SDK client per server instance, as Kameleoon recommends.
const abClient = new FakeKameleoonClient({ siteCode: 'demo' });
const abReady = abClient.initialize();

/**
 * Demo settings shared with public/fake-kameleoon.js: a `fk_*` query param wins and is
 * saved as a cookie, otherwise the cookie the client script's panel wrote is used.
 */
function demoSetting(req: Request, res: Response, name: string): string | undefined {
  const fromQuery = req.query[name];
  if (typeof fromQuery === 'string') {
    res.cookie(name, fromQuery, { path: '/', sameSite: 'lax' });
    return fromQuery;
  }
  return readCookie(req, name);
}

/** Server mode: the SDK picks each experiment's variant before Angular renders. */
function resolveAb(req: Request, res: Response): AbContext {
  if (demoSetting(req, res, 'fk_mode') !== 'server') return { mode: 'client', variations: {} };

  const visitorCode = abClient.getVisitorCode({ request: req, response: res });
  const forced = demoSetting(req, res, 'fk_variant');
  const experiments = (demoSetting(req, res, 'fk_exp') || DEFAULT_EXPERIMENTS).split(',');

  const variations: AbContext['variations'] = {};
  for (const id of experiments) {
    const featureKey = EXPERIMENT_FEATURES[id];
    if (!featureKey) continue;
    variations[featureKey] =
      forced === 'A' ? 'off' : forced === 'B' ? 'on' : abClient.getVariation({ visitorCode, featureKey }).key;
  }
  return { mode: 'server', variations };
}

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    // The A/B script isn't content-hashed, so make browsers revalidate it.
    setHeaders: (res, path) => {
      if (path.endsWith('fake-kameleoon.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  abReady
    .then(() => angularApp.handle(req, resolveAb(req, res)))
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
