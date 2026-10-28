import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="footer">
      <div class="container footer__grid">
        <div>
          <h4>Products</h4>
          <a href="#">Power tools</a><a href="#">Anchoring</a><a href="#">Measuring</a>
        </div>
        <div>
          <h4>Services</h4>
          <a href="#">Tool repair</a><a href="#">Fleet management</a><a href="#">Training</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About us</a><a href="#">Careers</a><a href="#">Contact</a>
        </div>
      </div>
      <p class="container footer__legal">Demo store for A/B testing experiments. Not a real shop.</p>
    </footer>
  `,
  styles: `
    .footer { margin-top: 64px; padding-top: 40px; background: #222; color: #bbb; }
    .footer__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; }
    h4 { margin: 0 0 12px; color: #fff; }
    a { display: block; margin-bottom: 8px; color: #bbb; text-decoration: none; }
    a:hover { color: #fff; }
    .footer__legal { margin-top: 32px; padding-block: 16px; border-top: 1px solid #333; font-size: 0.8rem; }
  `,
})
export class Footer {}
