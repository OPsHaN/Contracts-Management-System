import { Component } from "@angular/core";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  template: `
    <div class="loading-overlay" role="status" aria-live="polite" aria-label="جاري التحميل">
      <div class="logo-loader" aria-hidden="true">
        <img src="assets/pharmapact.png" alt="" />
      </div>
      <strong>جاري التحميل...</strong>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 18px;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(2px);
      color: #7f1d1d;
    }

    .logo-loader {
      position: relative;
      display: grid;
      place-items: center;
      width: 250px;
      height: 250px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 16px 38px rgba(127, 29, 29, 0.16);
    }

    .logo-loader::before {
      content: "";
      position: absolute;
      inset: -7px;
      border: 4px solid rgba(185, 28, 28, 0.16);
      border-top-color: #b91c1c;
      border-right-color: #171717;
      border-radius: 50%;
      animation: loader-spin 1s linear infinite;
    }

    img {
      width: 250px;
      max-height: 150px;
      object-fit: contain;
      animation: logo-pulse 1.2s ease-in-out infinite;
    }

    strong {
      font-size: 1rem;
      letter-spacing: 0;
    }

    @keyframes loader-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes logo-pulse {
      0%, 100% {
        transform: scale(0.94);
        opacity: 0.68;
      }
      50% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .logo-loader::before,
      img {
        animation: none;
      }
    }
  `,
})
export class LoadingOverlayComponent {}