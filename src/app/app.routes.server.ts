import { RenderMode, ServerRoute } from '@angular/ssr';

// Render on every request (not prerendered) so a variant can be chosen per visitor later.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
