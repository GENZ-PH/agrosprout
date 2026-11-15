import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { cropImage } from "../data/crop-images";
import { useCropPhoto } from "../data/crop-photo";
import { photoCreditLine } from "../data/crop-photo-core";
import { Icon } from "./Icon";
import { colors, radius, space, text } from "./theme";

// A crop's picture next to its name (#169). The name is always shown beside it, so the picture is
// decorative: screen readers skip it and read the name once. A crop with no picture (or one saved
// from the search, which isn't scored) shows a neutral placeholder.

type Props = {
  cropId: string;
  /** Square side in dp. */
  size?: number;
  /**
   * Scientific name of a crop with no bundled picture. The picture is then looked up online (Wikipedia and
   * Wikimedia Commons), and the screen must show `CropPhotoCredit` for the same name. Offline or not found: the placeholder.
   */
  sci?: string | null;
  /** A coloured frame, e.g. the crop's colour in the year strip, so picture and strip match. */
  borderColor?: string;
};

export function CropImage({ cropId, size = 48, sci = null, borderColor }: Props) {
  const bundled = cropImage(cropId);
  const photo = useCropPhoto(bundled ? null : sci);
  const [failed, setFailed] = useState<string | null>(null);
  const online = photo && failed !== photo.uri ? { uri: photo.uri } : null;
  const source = bundled ?? online;
  const box = { width: size, height: size, borderRadius: radius.sm };
  return (
    <View
      style={[styles.box, box, borderColor ? { borderWidth: 3, borderColor } : null]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {source ? (
        <Image
          source={source}
          style={[styles.image, box]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => photo && setFailed(photo.uri)}
        />
      ) : (
        <Icon name="sprout" size={Math.round(size * 0.5)} color={colors.green} />
      )}
    </View>
  );
}

/** The title, author and license of an online picture, under the crop it belongs to. Shows nothing when there is no online picture. */
export function CropPhotoCredit({ sci }: { sci: string | null }) {
  const photo = useCropPhoto(sci);
  if (!photo) return null;
  return (
    <View style={styles.credit}>
      <Pressable
        onPress={() => void Linking.openURL(photo.page)}
        accessibilityRole="link"
        accessibilityLabel={`${photoCreditLine(photo)}. Open the source page`}
      >
        <Text style={text.caption}>{photoCreditLine(photo)}</Text>
      </Pressable>
      {photo.licenseUrl ? (
        <Pressable
          onPress={() => void Linking.openURL(photo.licenseUrl as string)}
          accessibilityRole="link"
          accessibilityLabel={`Read the ${photo.license} license`}
        >
          <Text style={[text.caption, styles.creditLink]}>{photo.license} license</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  credit: { paddingVertical: space.xs, gap: space.xs },
  creditLink: { color: colors.blue, textDecorationLine: "underline" },
  box: { alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint, overflow: "hidden" },
  image: { backgroundColor: colors.greenTint },
});
