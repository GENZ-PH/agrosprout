import { type ComponentRef, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { otherCropId } from "../lots/crop-picks";
import { ADD_MAX_CHARS, searchCrops, type SearchEntry, type SearchResult } from "../lots/crop-search-core";
import { Icon } from "./Icon";
import { colors, MIN_TOUCH, radius, space, text } from "./theme";

// S2 crop search (#152): one box finds any crop, offline, in our crop list and the FAO Ecocrop names.
// Tapping the box shows our crop list; typing narrows it and adds Ecocrop crops. "Add “…”" saves what was typed.
// Our crops are saved by id and scored; any other crop is saved as `other:<name>` and not scored.

type Props = {
  lotName: string;
  entries: readonly SearchEntry[];
  picked: ReadonlySet<string>;
  onPick: (cropId: string) => void;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The crop id a result is saved as. */
const pickId = (r: SearchResult) => (r.entry.kind === "library" ? r.entry.crop_id : otherCropId(r.title)!);

export function CropSearch({ lotName, entries, picked, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const out = useMemo(() => searchCrops(entries, query), [entries, query]);
  const moreCount = useMemo(() => entries.filter((e) => e.kind === "ecocrop").length, [entries]);
  const addName = out.add ? capitalize(out.add) : null;
  const addId = addName ? otherCropId(addName) : null;
  const showing = open || query.trim().length > 0;

  const close = () => {
    setQuery("");
    setOpen(false);
    input.current?.blur();
    Keyboard.dismiss();
  };
  const pick = (id: string) => {
    if (!picked.has(id)) onPick(id);
    close();
  };
  const submit = () => {
    const first = out.results.find((r) => !picked.has(pickId(r)));
    if (first) pick(pickId(first));
    else if (addId && !picked.has(addId)) pick(addId);
  };

  return (
    <View style={styles.block}>
      <Text style={text.bodyStrong}>Search for a crop</Text>
      <View style={[styles.field, showing && styles.fieldOpen]}>
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setOpen(true)}
          onSubmitEditing={submit}
          maxLength={ADD_MAX_CHARS}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="Rice, mais, kamote, cassava…"
          placeholderTextColor={colors.muted}
          accessibilityLabel={`Search for a crop to add to ${lotName}`}
          style={styles.input}
        />
        {showing ? (
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close the search"
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      {showing ? (
        <View style={styles.results} accessibilityLiveRegion="polite">
          {query.trim() === "" ? (
            <Text style={text.caption}>
              Our crop list{moreCount > 0 ? `. Type to search ${moreCount.toLocaleString("en-US")} more crops from FAO Ecocrop.` : "."}
            </Text>
          ) : null}
          {out.results.map((r, i) => (
            <ResultRow
              key={r.entry.kind === "library" ? r.entry.crop_id : r.entry.code}
              r={r}
              last={i === out.results.length - 1 && !addName}
              browsing={query.trim() === ""}
              added={picked.has(pickId(r))}
              onPress={() => pick(pickId(r))}
            />
          ))}
          {addName && addId ? (
            <Pressable
              onPress={() => pick(addId)}
              disabled={picked.has(addId)}
              accessibilityRole="button"
              accessibilityLabel={picked.has(addId) ? `${addName}, already added` : `Add ${addName} as you typed it. It is not scored.`}
              accessibilityState={{ disabled: picked.has(addId) }}
              style={({ pressed }) => [styles.row, styles.addRow, pressed && styles.pressed]}
            >
              <Icon name={picked.has(addId) ? "check" : "plus"} size={20} color={colors.green} />
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>
                  {picked.has(addId) ? `${addName} is added` : `Add “${addName}”`}
                </Text>
                <Text style={text.caption}>Saved as you typed it. Not scored yet.</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** `browsing`: the list is our crop list before any typing, so the "Our crop list" tag is left out. */
function ResultRow({
  r,
  browsing,
  last,
  added,
  onPress,
}: {
  r: SearchResult;
  browsing: boolean;
  /** The list's last row draws no divider under it. */
  last: boolean;
  added: boolean;
  onPress: () => void;
}) {
  const e = r.entry;
  const ours = e.kind === "library";
  const local = ours ? e.local : null;
  const also = r.matched ? `Also called ${r.matched}` : null;
  const label = [
    added ? `${r.title}, already added` : `Add ${r.title}`,
    local,
    ours ? "From our crop list" : "Not scored yet",
    also,
    ours ? null : e.sci,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <Pressable
      onPress={onPress}
      disabled={added}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: added }}
      style={({ pressed }) => [styles.row, last && styles.lastRow, pressed && styles.pressed]}
    >
      <View style={[styles.flex, styles.body]}>
        <Text style={text.bodyStrong}>
          {r.title}
          {local ? <Text style={[text.body, { color: colors.muted }]}> · {local}</Text> : null}
        </Text>
        {browsing ? null : (
          <Text style={text.caption}>
            <Text style={ours ? styles.ours : undefined}>{ours ? "Our crop list" : "Not scored yet"}</Text>
            {also ? ` · ${also}` : ""}
            {!ours ? <Text style={styles.sci}> · {e.sci}</Text> : null}
          </Text>
        )}
      </View>
      {added ? (
        <View style={styles.added}>
          <Icon name="check" size={18} color={colors.green} />
          <Text style={[text.small, styles.ours]}>Added</Text>
        </View>
      ) : (
        <Icon name="plus" size={20} color={colors.green} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingLeft: space.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldOpen: { borderColor: colors.green, borderWidth: 2 },
  input: { ...text.body, flex: 1, minHeight: 48, paddingVertical: 0 },
  clear: { width: MIN_TOUCH + 4, height: MIN_TOUCH + 4, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  pressed: { backgroundColor: colors.pressed },
  results: {
    gap: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addRow: { borderBottomWidth: 0 },
  lastRow: { borderBottomWidth: 0 },
  body: { gap: 2 },
  ours: { color: colors.green, fontWeight: "600" },
  sci: { fontStyle: "italic" },
  added: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
