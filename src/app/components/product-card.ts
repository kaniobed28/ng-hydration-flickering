import { Component, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../data/products';
import { CartService } from '../data/cart.service';
import { ProductImage } from './product-image';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, RouterLink, ProductImage],
  template: `
    <article class="card" [attr.data-product-id]="product().id">
      <a [routerLink]="['/product', product().id]" class="card__link">
        @if (product().badge) {
          <span class="badge">{{ product().badge }}</span>
        }
        <app-product-image [category]="product().category" />
        <h3>{{ product().name }}</h3>
        <p class="rating">★ {{ product().rating }} <span>({{ product().reviews }})</span></p>
      </a>
      <div class="card__footer">
        <span class="price">{{ product().price | currency: 'EUR' }}</span>
        <button class="btn btn--primary" (click)="cart.add(product())">Add to cart</button>
      </div>
    </article>
  `,
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();
  protected readonly cart = inject(CartService);
}
