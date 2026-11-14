import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_VERSION } from "../env";
import { buildBackup, restoreBackup, type FarmBackup } from "./backup-core";
import { toFarm } from "./farm-core";
import { useFarmStore } from "./farm-store";

export { backupFileName, describeBackup, parseBackup, serializeBackup, type FarmBackup } from "./backup-core";

/**
 * Backup file for the farm (#49). The screen saves `serializeBackup(await makeBackup())` as
 * `backupFileName(...)` (web: download; Android: share sheet), and for a restore reads the
 * picked file, calls `parseBackup(text)`, shows `describeBackup(...)` for confirmation,
 * then calls `applyBackup(...)`. Nothing is uploaded.
 */
export const makeBackup = () =>
  buildBackup({
    farm: toFarm(useFarmStore.getState()),
    readKey: (k) => AsyncStorage.getItem(k),
    appVersion: APP_VERSION,
  });

/** Replaces the farm on this device with the backup. Only after the farmer confirms. */
export const applyBackup = (backup: FarmBackup) =>
  restoreBackup({
    backup,
    currentLots: useFarmStore.getState().lots,
    replaceFarm: useFarmStore.getState().replaceFarm,
    removeKey: (k) => AsyncStorage.removeItem(k),
    writeKey: (k, v) => AsyncStorage.setItem(k, v),
  });
