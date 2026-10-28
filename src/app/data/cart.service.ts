import { Injectable, computed, signal } from '@angular/core';
import { Product } from './products';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly items = signal<Product[]>([]);

  readonly count = computed(() => this.items().length);
  readonly total = computed(() => this.items().reduce((sum, p) => sum + p.price, 0));

  add(product: Product) {
    this.items.update((items) => [...items, product]);
  }
}
