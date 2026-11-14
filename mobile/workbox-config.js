// Service worker for the web build (PWA). Run after `expo export`: see "build:web" in package.json.
// Precaches the app shell so the web app opens offline after the first visit.
// API data offline comes from the TanStack Query cache (src/state/query-client.ts), not from here.
module.exports = {
  globDirectory: "dist/",
  // webp: the crop pictures (#172), so they show offline too (#36). jpg/jpeg for any later photos.
  globPatterns: ["**/*.{js,css,html,ttf,woff2,ico,png,jpg,jpeg,webp,svg,json}"],
  globIgnores: ["sw.js", "workbox-*.js", "metadata.json"],
  swDest: "dist/sw.js",
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  // Single-page app: every route falls back to the cached index.html when offline.
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/_expo\//, /\/[^/?]+\.[^/]+$/],
  // A new deploy takes over on the next load instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
};
