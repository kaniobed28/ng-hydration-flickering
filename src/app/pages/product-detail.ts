import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe, KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CATEGORIES, PRODUCTS } from '../data/products';
import { CartService } from '../data/cart.service';
import { ProductImage } from '../components/product-image';

@Component({
  selector: 'app-product-detail',
  imports: [CurrencyPipe, KeyValuePipe, RouterLink, ProductImage],
  template: `
    <div class="container">
      @if (product(); as p) {
        <p class="breadcrumb">
          <a routerLink="/">Home</a> / <a [routerLink]="['/products', p.category]">{{ categoryName() }}</a> / {{ p.name }}
        </p>
        <div class="pdp">
          <app-product-image [category]="p.category" class="pdp__img" />
          <div>
            <h1>{{ p.name }}</h1>
            <p class="rating">★ {{ p.rating }} · {{ p.reviews }} reviews</p>
            <p>{{ p.summary }}</p>
            <p class="price" id="pdp-price">{{ p.price | currency: 'EUR' }} <small>excl. VAT</small></p>
            <button class="btn btn--primary btn--lg" id="pdp-add-to-cart" (click)="cart.add(p)">Add to cart</button>
            <h2>Technical data</h2>
            <table class="specs">
              <tbody>
                @for (s of p.specs | keyvalue: keepOrder; track s.key) {
                  <tr><th>{{ s.key }}</th><td>{{ s.value }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <h1>Product not found</h1>
        <a routerLink="/products">Back to products</a>
      }
    </div>
  `,
  styles: `
    .pdp { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .pdp__img { border: 1px solid var(--border); }
    .rating { color: var(--muted); }
    .price { font-size: 1.8rem; font-weight: 700; }
    .price small { font-size: 0.9rem; font-weight: 400; color: var(--muted); }
    .specs { width: 100%; border-collapse: collapse; }
    .specs th, .specs td { padding: 10px; border-bottom: 1px solid var(--border); text-align: left; }
    .specs th { width: 45%; color: var(--muted); font-weight: 600; }
    @media (max-width: 720px) { .pdp { grid-template-columns: 1fr; gap: 16px; } }
  `,
})
export class ProductDetail {
  /** Bound from the `:id` route param. */
  readonly id = input.required<string>();

  protected readonly cart = inject(CartService);
  protected readonly product = computed(() => PRODUCTS.find((p) => p.id === this.id()));
  protected readonly categoryName = computed(() => CATEGORIES.find((c) => c.id === this.product()?.category)?.name);
  protected readonly keepOrder = () => 0;
}
