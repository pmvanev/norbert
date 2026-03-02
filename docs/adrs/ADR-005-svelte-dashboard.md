# ADR-005: Svelte 5 with SvelteKit for Dashboard

## Status
Accepted

## Context
Norbert's web dashboard is a single-page application served on localhost. It needs: interactive DAG visualization (D3.js integration), real-time WebSocket updates, responsive data tables, and charts. Solo developer must ship quickly. Dashboard bundle size matters -- local tool should load instantly.

## Decision
Svelte 5 with SvelteKit (for routing and build tooling). D3.js for DAG visualization. Chart.js for cost/trend charts.

## Alternatives Considered

### Alternative 1: React 19 with Next.js
- Largest ecosystem. Most hiring-compatible. Most component libraries.
- ~40 KB runtime (React + ReactDOM) vs ~2 KB (Svelte). More boilerplate for same functionality.
- D3.js integration requires useRef/useEffect dance. Chart libraries are abundant.
- Rejection: Bundle size and boilerplate overhead unjustifiable for a local tool with one developer. Svelte achieves the same with less code and smaller output.

### Alternative 2: Vue 3 with Nuxt
- Good middle ground. Composition API is clean. Smaller than React.
- ~30 KB runtime. Moderate boilerplate.
- D3.js integration is clean (onMounted lifecycle).
- Rejection: Viable choice, but Svelte 5 runes provide finer-grained reactivity with even less code. For solo developer maximizing DX, Svelte edges out Vue.

### Alternative 3: Vanilla JS + Web Components
- Zero framework overhead. Maximum performance.
- Manual state management. Manual DOM updates. No component abstractions.
- Rejection: Development speed too slow for 8 dashboard views. Framework overhead is justified for productivity.

## Consequences
- Positive: Smallest bundle size (~2 KB runtime) -- dashboard loads instantly on localhost
- Positive: Svelte 5 runes provide fine-grained reactivity with minimal code
- Positive: SvelteKit provides file-based routing, SSR capability, Vite integration
- Positive: Less boilerplate per component than React/Vue -- solo developer ships faster
- Negative: Smaller ecosystem than React (fewer ready-made component libraries)
- Negative: D3.js integration with Svelte has fewer examples than with React
- Negative: Fewer developers familiar with Svelte if team grows
