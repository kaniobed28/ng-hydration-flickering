import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CATEGORIES } from '../data/products';
import { CartService } from '../data/cart.service';

@Component({
  selector: 'app-header',
  imports: [CurrencyPipe, RouterLink, RouterLinkActive],
  template: `
    <div class="topbar">
      <div class="container topbar__inner">
        <span>Free delivery on orders over €100</span>
        <span>Customer service: +00 000 000 000</span>
      </div>
    </div>
    <header class="header">
      <div class="container header__inner">
        <a routerLink="/" class="logo" aria-label="Home">HILTI</a>
        <form class="search" (submit)="$event.preventDefault()">
          <input type="search" placeholder="Search products, articles, services" aria-label="Search" />
          <button type="submit" class="btn btn--primary">Search</button>
        </form>
        <div class="header__actions">
          <a href="#" (click)="$event.preventDefault()">Sign in</a>
          <a routerLink="/cart" class="cart" id="header-cart">
            Cart <span class="cart__count">{{ cart.count() }}</span>
            <small>{{ cart.total() | currency: 'EUR' }}</small>
          </a>
        </div>
      </div>
    </header>
    <nav class="nav">
      <div class="container nav__inner">
        <a routerLink="/products" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">All products</a>
        @for (c of categories; track c.id) {
          <a [routerLink]="['/products', c.id]" routerLinkActive="active">{{ c.name }}</a>
        }
      </div>
    </nav>
  `,
  styleUrl: './header.scss',
})
export class Header {
  protected readonly cart = inject(CartService);
  protected readonly categories = CATEGORIES;
}
