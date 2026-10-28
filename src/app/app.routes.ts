import { Routes } from '@angular/router';
import { Home } from './pages/home';
import { ProductList } from './pages/product-list';
import { ProductDetail } from './pages/product-detail';
import { Cart } from './pages/cart';
import { Lab } from './pages/lab';

export const routes: Routes = [
  { path: '', component: Home, title: 'Home | Tool Store' },
  { path: 'products', component: ProductList, title: 'Products | Tool Store' },
  { path: 'products/:category', component: ProductList, title: 'Products | Tool Store' },
  { path: 'product/:id', component: ProductDetail, title: 'Product | Tool Store' },
  { path: 'cart', component: Cart, title: 'Cart | Tool Store' },
  { path: 'lab', component: Lab, title: 'A/B Lab | Tool Store' },
  { path: '**', redirectTo: '' },
];
