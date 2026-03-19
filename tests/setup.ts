/**
 * Vitest global test setup.
 *
 * Stubs browser APIs not available in jsdom/happy-dom that third-party
 * libraries (e.g., uPlot) call on module initialization.
 */

// uPlot calls window.matchMedia on load for DPR detection.
// jsdom does not implement matchMedia.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// uPlot accesses ResizeObserver for auto-sizing.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
