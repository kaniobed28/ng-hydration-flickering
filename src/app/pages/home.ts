import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIES, PRODUCTS } from '../data/products';
import { ProductCard } from '../components/product-card';
import { ProductImage } from '../components/product-image';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, ProductImage],
  template: `
    <!-- Hero: a good first A/B test target (headline, CTA text/colour) -->
    <section class="hero" id="home-hero">
      <div class="container hero__inner">
        <div>
          <p class="eyebrow">Nuron cordless platform</p>
          <h1 class="hero__title">One battery. Every tool. Every job.</h1>
          <p class="hero__text">Switch your whole fleet to a single 22 V platform and cut downtime on site.</p>
          <a routerLink="/products/drilling" class="btn btn--primary btn--lg" id="hero-cta">Shop cordless tools</a>
        </div>
        <app-product-image category="drilling" class="hero__img" />
      </div>
    </section>

    <section class="container section">
      <h2>Shop by category</h2>
      <div class="categories">
        @for (c of categories; track c.id) {
          <a [routerLink]="['/products', c.id]" class="category">
            <app-product-image [category]="c.id" />
            <strong>{{ c.name }}</strong>
            <span>{{ c.description }}</span>
          </a>
        }
      </div>
    </section>

    <section class="container section">
      <div class="section__head">
        <h2>Popular products</h2>
        <a routerLink="/products">See all</a>
      </div>
      <div class="grid">
        @for (p of popular; track p.id) {
          <app-product-card [product]="p" />
        }
      </div>
    </section>

    <section class="container section usp" id="usp-bar">
      <div><strong>Lifetime service</strong><span>Repairs and wear-part replacement included.</span></div>
      <div><strong>Fast delivery</strong><span>Order before 5 pm, on site tomorrow.</span></div>
      <div><strong>Expert advice</strong><span>Talk to an engineer about your project.</span></div>
    </section>
  `,
  styleUrl: './home.scss',
})
export class Home {
  protected readonly categories = CATEGORIES;
  protected readonly popular = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 4);
}
