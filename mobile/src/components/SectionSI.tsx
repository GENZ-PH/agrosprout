import { useEffect, useState } from "react";
import type { Lang } from "../i18n/core";
import { useLang } from "../i18n/lang-store";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { hc } from "hono/client";

import type { AppType } from "../../../api/types/index";
import { API_URL, unwrap } from "../api/client";
import { fetchWithTimeout } from "../net/fetch";
import { useOnline } from "../net/useOnline";
import { SI_LINKS, SISource } from "./SISource";
import type { PanelSection } from "./panel-si";
import { linksIn } from "./satellite-facts";
import { colors, radius, space, text } from "./theme";

// One plain SI insight at the top of each section of the technical data panel (2026-11-15). Every
// section on the panel shares one call (the first to ask sends all sections), and the answers are
// kept on the device, so switching tabs or lots and back costs nothing.

const api = hc<AppType>(API_URL, { fetch: (i: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(i, init, 60_000) });
const inFlight = new Map<string, Promise<(string | null)[]>>();
const PREFIX = "si-section:";

const storage = (): Storage | null => {
  try {
    return Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};
const read = (key: string): string | null => {
  try {
    return storage()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    storage()?.setItem(PREFIX + key, value);
  } catch {
    // Storage full or blocked: the answer is still shown for this visit.
  }
};

function askAll(sections: PanelSection[], lang: Lang): Promise<(string | null)[]> {
  const key = lang + JSON.stringify(sections);
  let p = inFlight.get(key);
  if (!p) {
    const idx = sections.flatMap((s, i) => (s.facts.length ? [i] : []));
    p = unwrap(api.v1["explain-sections"].$post({ json: { sections: idx.map((i) => sections[i]), ...(lang !== "en" ? { lang } : {}) } })).then((d) => {
      const notes: (string | null)[] = sections.map(() => null);
      d.notes.forEach((t, k) => {
        notes[idx[k]] = t;
        if (t) write(lang + JSON.stringify(sections[idx[k]]), t);
      });
      return notes;
    });
    p.catch(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return p;
}

/** The insight for `sections[index]`. Shows nothing offline, during a what-if, or if SI has nothing. */
export function SectionSI({ sections, index, whatIf }: { sections: PanelSection[]; index: number; whatIf: boolean }) {
  const online = useOnline();
  const lang = useLang();
  const allKey = lang + JSON.stringify(sections);
  const saved = read(lang + JSON.stringify(sections[index]));
  const [got, setGot] = useState<{ key: string; notes: (string | null)[] | null }>({ key: "", notes: null });
  const wanted = !whatIf && online && !saved && sections[index].facts.length > 0;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    askAll(sections, lang).then(
      (notes) => live && setGot({ key: allKey, notes }),
      () => live && setGot({ key: allKey, notes: null }),
    );
    return () => {
      live = false;
    };
    // `allKey` stands for `sections`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKey, wanted]);

  const fetched = got.key === allKey;
  const note = saved ?? (fetched ? (got.notes?.[index] ?? null) : null);
  if (!note && wanted && !fetched)
    return (
      <View style={[styles.box, styles.row]}>
        <ActivityIndicator size="small" color={colors.green} />
        <Text style={text.caption}>SI is reading this section…</Text>
      </View>
    );
  if (!note) return null;
  return (
    <View style={styles.box} accessibilityLabel={`SI insight: ${note}`}>
      <Text style={styles.tag}>SI insight</Text>
      <Text style={text.small}>{note}</Text>
      <SISource
        lead="Written by SI (Claude, by Anthropic) from the numbers in this section only."
        given={sections[index].facts}
        links={[SI_LINKS.power, SI_LINKS.powerMethod, ...linksIn(sections[index].facts), SI_LINKS.fao56, SI_LINKS.ecocrop, SI_LINKS.claude]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 2, padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.greenTint, borderLeftWidth: 3, borderLeftColor: colors.green },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tag: { fontSize: 12, fontWeight: "700", color: colors.green },
});
