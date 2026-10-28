import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIES, PRODUCTS } from '../data/products';
import { ProductCard } from '../components/product-card';

@Component({
  selector: 'app-product-list',
  imports: [RouterLink, ProductCard],
  template: `
    <div class="container">
      <p class="breadcrumb">
        <a routerLink="/">Home</a> / <a routerLink="/products">Products</a>
        @if (current(); as c) { / {{ c.name }} }
      </p>
      <h1>{{ current()?.name ?? 'All products' }}</h1>
      @if (current(); as c) {
        <p class="lead">{{ c.description }}</p>
      }
      <p class="count">{{ products().length }} products</p>
      <div class="grid">
        @for (p of products(); track p.id) {
          <app-product-card [product]="p" />
        } @empty {
          <p>No products found.</p>
        }
      </div>
    </div>
  `,
  styles: `
    .lead { margin-top: -8px; color: var(--muted); }
    .count { font-weight: 600; }
  `,
})
export class ProductList {
  /** Bound from the `:category` route param. */
  readonly category = input<string>();

  protected readonly current = computed(() => CATEGORIES.find((c) => c.id === this.category()));
  protected readonly products = computed(() =>
    this.category() ? PRODUCTS.filter((p) => p.category === this.category()) : PRODUCTS,
  );
}
