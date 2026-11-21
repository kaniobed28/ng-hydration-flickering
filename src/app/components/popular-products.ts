import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRODUCTS } from '../data/products';
import { ProductCard } from './product-card';
import { AbService } from '../ab/ab.service';
import { FEATURES } from '../ab/features';

/**
 * "Popular products" on the home page. A separate component so that it can be
 * excluded from hydration with ngSkipHydration (configuration C).
 */
@Component({
  selector: 'app-popular-products',
  imports: [RouterLink, ProductCard],
  template: `
    <section class="container section">
      <div class="section__head">
        <h2>Popular products</h2>
        <a routerLink="/products">See all</a>
      </div>
      <div class="grid">
        @for (p of popular(); track p.id) {
          <app-product-card [product]="p" />
        }
      </div>
    </section>
  `,
  host: { style: 'display: block' },
})
export class PopularProducts {
  private readonly ab = inject(AbService);
  protected readonly popular = computed(() => {
    const products = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 4);
    return this.ab.isOn(FEATURES.popularOrder) ? products.reverse() : products;
  });
}
