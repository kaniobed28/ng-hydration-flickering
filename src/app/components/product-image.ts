import { Component, input } from '@angular/core';
import { CategoryId } from '../data/products';

/** Simple SVG placeholder per category, so the app has no external image dependencies. */
@Component({
  selector: 'app-product-image',
  template: `
    <svg viewBox="0 0 120 90" [attr.aria-label]="category()" role="img">
      <rect width="120" height="90" fill="#f3f3f3" />
      @switch (category()) {
        @case ('drilling') {
          <rect x="22" y="30" width="56" height="22" rx="4" fill="#d2051e" />
          <rect x="78" y="37" width="26" height="8" fill="#555" />
          <rect x="36" y="52" width="16" height="26" rx="3" fill="#333" />
          <rect x="32" y="72" width="24" height="8" rx="2" fill="#d2051e" />
        }
        @case ('cutting') {
          <circle cx="44" cy="45" r="24" fill="#999" />
          <circle cx="44" cy="45" r="5" fill="#333" />
          <rect x="56" y="36" width="44" height="18" rx="6" fill="#d2051e" />
        }
        @case ('anchoring') {
          <rect x="54" y="12" width="12" height="66" fill="#888" />
          @for (y of [20, 30, 40, 50, 60]; track y) {
            <rect x="50" [attr.y]="y" width="20" height="3" fill="#555" />
          }
          <rect x="46" y="10" width="28" height="6" fill="#333" />
        }
        @case ('measuring') {
          <rect x="34" y="18" width="52" height="56" rx="8" fill="#d2051e" />
          <rect x="42" y="26" width="36" height="20" rx="2" fill="#222" />
          <line x1="86" y1="40" x2="116" y2="40" stroke="#d2051e" stroke-width="2" stroke-dasharray="4 3" />
        }
        @default {
          <rect x="30" y="26" width="60" height="40" rx="5" fill="#333" />
          <rect x="30" y="26" width="60" height="10" rx="3" fill="#d2051e" />
          <text x="60" y="56" font-size="12" text-anchor="middle" fill="#fff" font-family="sans-serif">22V</text>
        }
      }
    </svg>
  `,
  styles: `:host { display: block; } svg { width: 100%; height: auto; display: block; }`,
})
export class ProductImage {
  readonly category = input.required<CategoryId>();
}
