import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CATEGORIES } from '../data/products';
import { CartService } from '../data/cart.service';
import { AbService } from '../ab/ab.service';
import { FEATURES } from '../ab/features';

@Component({
  selector: 'app-header',
  imports: [CurrencyPipe, RouterLink, RouterLinkActive],
  template: `
    <div class="topbar">
      <div class="container topbar__inner">
        <span>Free delivery on orders over €100</span>
        <a routerLink="/lab" class="topbar__lab">A/B Lab →</a>
      </div>
    </div>
    <header class="header">
      <div class="container header__inner">
        <a routerLink="/" class="logo" aria-label="Home">TOOL STORE</a>
        <form class="search" (submit)="$event.preventDefault()">
          <input type="search" placeholder="Search products, articles, services" aria-label="Search" />
          <button type="submit" class="btn btn--primary">Search</button>
        </form>
        <div class="header__actions">
          <a href="#" (click)="$event.preventDefault()">Sign in</a>
          <a routerLink="/cart" class="cart" id="header-cart">
            Cart <span class="cart__count">{{ cart.count() }}</span>
            <small>{{ ab.isOn(features.cartMessage) ? 'Free delivery over €100' : (cart.total() | currency: 'EUR') }}</small>
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
  protected readonly ab = inject(AbService);
  protected readonly features = FEATURES;
}
