import { StyleSheet, Text, View } from "react-native";

import { CropImage } from "./CropImage";
import { shortCropName } from "./recommendations-core";
import { colors, radius, space, text } from "./theme";

// The crops of an option or a lot as small picture + name chips (#169), so a farmer can see the
// plants at a glance. Each crop once, in the order given. The names are the real text; the pictures
// are decorative (see CropImage).

type Props = {
  cropIds: readonly string[];
  cropName: (id: string) => string;
};

export function CropChips({ cropIds, cropName }: Props) {
  const ids = [...new Set(cropIds)];
  if (ids.length === 0) return null;
  return (
    <View style={styles.row}>
      {ids.map((id) => (
        <View key={id} style={styles.chip}>
          <CropImage cropId={id} size={28} />
          <Text style={text.small}>{shortCropName(cropName(id))}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: 2,
    paddingLeft: 2,
    paddingRight: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
