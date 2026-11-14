import { Image, StyleSheet, View } from "react-native";

import { cropImage } from "../data/crop-images";
import { Icon } from "./Icon";
import { colors, radius } from "./theme";

// A crop's picture next to its name (#169). The name is always shown beside it, so the picture is
// decorative: screen readers skip it and read the name once. A crop with no picture (or one saved
// from the search, which isn't scored) shows a neutral placeholder.

type Props = {
  cropId: string;
  /** Square side in dp. */
  size?: number;
};

export function CropImage({ cropId, size = 48 }: Props) {
  const source = cropImage(cropId);
  const box = { width: size, height: size, borderRadius: radius.sm };
  return (
    <View
      style={[styles.box, box]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {source ? (
        <Image source={source} style={[styles.image, box]} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="sprout" size={Math.round(size * 0.5)} color={colors.green} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint, overflow: "hidden" },
  image: { backgroundColor: colors.greenTint },
});
