import { html } from '@mickyballadelli/matrix';

// Original ImageGen mark: two offset frames intersecting around an aperture.
export function Logo() {
  return html`<svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="7" y="7" width="29" height="29" rx="10" stroke="currentColor" stroke-width="1.7" />
    <rect x="13" y="13" width="29" height="29" rx="10" stroke="currentColor" stroke-width="1.7" opacity=".5" />
    <path d="M17 30 24 16l7 14M20 25h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="36" cy="10" r="3.5" fill="currentColor" />
  </svg>`;
}
