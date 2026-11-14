import Constants from "expo-constants";
import { Platform } from "react-native";

// The only place that reads EXPO_PUBLIC_* (pattern from Bluesky's src/env).
// Expo inlines these at build time, so each must be read with its full literal name.

/** Worker API base URL. Set per environment in Cloudflare Pages, or in mobile/.env.local. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

/** App version from app.json; also used to drop the saved API cache after a release. */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export const IS_WEB = Platform.OS === "web";
export const IS_NATIVE = !IS_WEB;
export const IS_DEV = __DEV__;
