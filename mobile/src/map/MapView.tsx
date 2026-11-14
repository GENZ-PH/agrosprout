import { type ComponentProps, type ComponentType, type Ref, useCallback, useRef } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import type { AppToMap, MapToApp } from "./bridge";
import { MAP_HTML } from "./map-html.generated";
import { type MapViewProps, useMapBridge } from "./useMapBridge";

export type { MapViewHandle, MapViewProps } from "./useMapBridge";

// react-native-webview 14 types WebView as a plain function component, so `ref` is
// not in its props even though the Android component forwards it. Add it back.
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WebViewWithRef = WebView as unknown as ComponentType<
  ComponentProps<typeof WebView> & { ref?: Ref<WebViewHandle> }
>;

// The page's origin. Tile servers see it as the referrer; nothing is loaded from it.
const BASE_URL = "https://agrosprout.pages.dev/";

/** Android (and iOS): the map page in a WebView. Web uses MapView.web.tsx. */
export function MapView(props: MapViewProps) {
  const webRef = useRef<WebViewHandle>(null);
  const postToPage = useCallback((msg: AppToMap) => {
    webRef.current?.injectJavaScript(`window.agroMap&&window.agroMap.receive(${JSON.stringify(msg)});true;`);
  }, []);
  const fromPage = useMapBridge(props, postToPage);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        fromPage(JSON.parse(e.nativeEvent.data) as MapToApp);
      } catch {
        // Not a bridge message.
      }
    },
    [fromPage],
  );

  // Keep the WebView on the map page; attribution links open in the browser.
  const onShouldStartLoad = useCallback((req: ShouldStartLoadRequest) => {
    if (req.url === BASE_URL || req.url === "about:blank") return true;
    if (req.url.startsWith("http")) void Linking.openURL(req.url);
    return false;
  }, []);

  return (
    <View style={[styles.box, props.style]}>
      <WebViewWithRef
        ref={webRef}
        source={{ html: MAP_HTML, baseUrl: BASE_URL }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoad}
        // Stops the screen's ScrollView from stealing one-finger drawing on Android.
        nestedScrollEnabled
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        accessibilityLabel={props.accessibilityLabel}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden" },
  web: { flex: 1, backgroundColor: "#3F4A30" },
});
