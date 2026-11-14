import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LotDataStore } from './power';

/**
 * On-device store for per-lot climate data (key `lotdata:<lotId>`, see
 * docs/06-architecture.md). Uses localStorage on web through AsyncStorage.
 * Kept out of `power.ts` so the parser and `ensureLotData` stay free of React
 * Native imports and run under Node tests.
 */
export const asyncStorageLotDataStore: LotDataStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
};
