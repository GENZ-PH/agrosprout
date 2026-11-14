import { useCallback, useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { type AppToMap, BRIDGE_SOURCE_APP, BRIDGE_SOURCE_MAP, type BridgeEnvelope, type MapToApp } from "./bridge";
import { MAP_HTML } from "./map-html.generated";
import { type MapViewProps, useMapBridge } from "./useMapBridge";

export type { MapViewHandle, MapViewProps } from "./useMapBridge";

/** Web: the same map page in an <iframe srcDoc>, talking through window.postMessage. */
export function MapView(props: MapViewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const postToPage = useCallback((msg: AppToMap) => {
    const envelope: BridgeEnvelope<AppToMap> = { source: BRIDGE_SOURCE_APP, msg };
    frameRef.current?.contentWindow?.postMessage(envelope, "*");
  }, []);
  const fromPage = useMapBridge(props, postToPage);

  // Layout effect, so the listener exists before the iframe can say "ready".
  useLayoutEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as Partial<BridgeEnvelope<MapToApp>> | null;
      if (data?.source === BRIDGE_SOURCE_MAP && data.msg) fromPage(data.msg);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fromPage]);

  return (
    <View style={[styles.box, props.style]}>
      <iframe
        ref={frameRef}
        srcDoc={MAP_HTML}
        title={props.accessibilityLabel ?? "Map"}
        style={{ border: 0, width: "100%", height: "100%", display: "block", background: "#3F4A30" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden" },
});
