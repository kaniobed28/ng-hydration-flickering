// Vercel serverless function: hands every page request to the Angular SSR Express app
// (src/server.ts), so the server-side SDK mode works the same as locally.
export { reqHandler as default } from '../dist/ng-hydration/server/server.mjs';
