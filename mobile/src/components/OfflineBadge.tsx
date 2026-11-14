import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { asyncStorageLotDataStore } from "../data/lotdata-store";
import { dataDate, offlineDetail } from "../net/offline-core";
import { useOnline } from "../net/useOnline";
import { useFarmStore } from "../state/farm-store";
import { Icon } from "./Icon";
import { readLotData } from "./lot-analysis-core";
import { colors, radius, space, text } from "./theme";
import { DEMO_FARMS } from "./useLotAnalysis";

// The Offline notice (#36): shown under every screen title while the phone has no signal. It says
// the results use the NASA data saved on the phone and when that data was last updated, and names
// the lots still waiting for theirs (the lot sync downloads them when the signal is back).

export function OfflineBadge() {
  const online = useOnline();
  return online ? null : <OfflineNotice />;
}

function OfflineNotice() {
  const lots = useFarmStore((s) => s.lots);
  // Read the saved data again when a lot's data changes (a new download, a moved lot, a lot added or deleted).
  const refs = lots.filter((l) => l.data_status === "ready").map((l) => l.data_ref);
  const key = refs.join("|");
  const [read, setRead] = useState<{ key: string; dates: string[] } | null>(null);

  useEffect(() => {
    let current = true;
    const keyRefs = key ? key.split("|") : [];
    Promise.all(keyRefs.map((ref) => readLotData(ref, asyncStorageLotDataStore, DEMO_FARMS))).then((all) => {
      if (!current) return;
      const dates = all.flatMap((d) => {
        const day = d ? dataDate(d) : null;
        return day ? [day] : [];
      });
      setRead({ key, dates });
    });
    return () => {
      current = false;
    };
  }, [key]);

  const pending = lots.filter((l) => l.data_status === "pending").map((l) => l.name);
  const detail = offlineDetail({ dates: read?.key === key ? read.dates : null, pending });
  return (
    <View
      style={styles.box}
      accessible
      accessibilityLabel={detail ? `Offline. ${detail}` : "Offline."}
      accessibilityLiveRegion="polite"
    >
      <Icon name="offline" size={20} color={colors.amber} />
      <Text style={styles.text}>
        <Text style={styles.strong}>Offline.</Text>
        {detail ? ` ${detail}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.amberTint,
  },
  text: { ...text.small, flex: 1, color: colors.ink },
  strong: { fontWeight: "700" },
});
