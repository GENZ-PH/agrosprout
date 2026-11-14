# mobile/: AgriResilience app (Expo React Native)

One codebase for the **Android app** (farmers) and the **web build** (judges). Expo SDK 58, TypeScript, expo-router.

## Run it

```bash
cd mobile
npm install
cp .env.example .env.local   # API URL for local dev (see docs/12-infrastructure.md)
npx expo start
```

- **Android phone:** install **Expo Go** from the Play Store, then scan the QR code shown in the terminal. Phone and laptop must be on the same Wi-Fi (or run `npx expo start --tunnel`).
- **Web:** press `w` in the terminal, or run `npx expo start --web`.
- **Web build (what Cloudflare Pages deploys):** `npm run build:web` writes `dist/` (Expo export + PWA service worker). Install it from the browser like an app; see "Web app as a PWA" in `docs/12-infrastructure.md`.

To reach a local API from the phone, set `EXPO_PUBLIC_API_URL` to your laptop's LAN IP, e.g. `http://192.168.1.20:8787`.

## Before every PR

```bash
npm run check   # typecheck + lint + Node tests (also runs in the Cloudflare build)
```

Add packages with `npx expo install <package>` (picks SDK-compatible versions) and announce new dependencies in chat to avoid lockfile conflicts.

## Layout and owners (D22)

| Path | What | Owner |
|---|---|---|
| `app/` | expo-router screens: `index` (welcome), `lots`, `crops`, `dashboard`, `months`, `compare`, `places` | Frontend |
| `map-src/` | Leaflet + Terra Draw page, bundled to `map.html` | Frontend |
| `assets/data/` | generated `crops.json`, `demo/*.json` | Data |
| `src/engine/` | pure TypeScript engine (no React Native imports) | Engine |
| `src/data/` | NASA POWER, ET₀, routing, storage | Data |
| `src/map/` | map WebView/iframe + `bridge.ts` | Frontend |
| `src/components/` | charts, cards, ⓘ explainers | Frontend |
| `src/types.ts` | shared data contracts (PR only) | Engine + Data |
| `src/api/` | typed API client + `useApiQuery` / `useApiMutation` | Infra (#2) |
| `src/state/` | TanStack Query client + persisted Zustand stores (export each store from `stores.ts`) | Infra (#2) |

API, state and deployment details: [docs/12-infrastructure.md](../docs/12-infrastructure.md).
