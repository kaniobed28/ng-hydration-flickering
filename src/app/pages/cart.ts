import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../data/cart.service';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <div class="container">
      <h1>Your cart</h1>
      @if (cart.count()) {
        <p>{{ cart.count() }} item(s) — total <strong>{{ cart.total() | currency: 'EUR' }}</strong></p>
        <button class="btn btn--primary btn--lg" id="checkout-btn">Proceed to checkout</button>
      } @else {
        <p>Your cart is empty. <a routerLink="/products">Continue shopping</a></p>
      }
    </div>
  `,
})
export class Cart {
  protected readonly cart = inject(CartService);
}
