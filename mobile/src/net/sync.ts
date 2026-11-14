import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

// Tell TanStack Query when the phone goes offline/online and when the app returns
// to the foreground (pattern from delvo.ph and Bluesky). Web version: sync.web.ts.
export function startQuerySync() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  const sub = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
  return () => sub.remove();
}
