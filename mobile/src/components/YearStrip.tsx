import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { hc } from "hono/client";

import type { AppType } from "../../../api/types/index";
import type { RotationOption } from "../engine";
import { API_URL, unwrap } from "../api/client";
import { fetchWithTimeout } from "../net/fetch";
import { useOnline } from "../net/useOnline";
import type { Crop, LotData } from "../types";
import { familyStyle, MONTH_NAMES } from "./field-year-core";
import { yearStrip } from "./farmer-core";
import { Icon } from "./Icon";
import { explainMonthRequest, monthLines, MONTH_LONG, readSaved, save, stripMonths, type StripMonth } from "./month-si";
import { colors, radius, space, text } from "./theme";

// The suggestion's year as a strip you can drag (2026-11-15): 12 months back, this month (outlined),
// and 2 years ahead. The plan repeats every year, so past months show what the plan would have done.
// The row names stay put while the months scroll. Hover (web) or tap a month for what happens in it:
// the engine's lines at once, then a short SI note on why (from that month's NASA rain), kept on the
// device so the same month is not asked twice.

const CELL = 34;
const GAP = 3;
const STEP = CELL + GAP;
const BACK = 12;

const siApi = hc<AppType>(API_URL, { fetch: (i: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(i, init, 60_000) });
const inFlight = new Map<string, Promise<string>>();
const storage = (): Storage | null => {
  try {
    return Platform.OS === "web" && typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

function askMonth(req: ReturnType<typeof explainMonthRequest>): Promise<string> {
  const key = JSON.stringify(req);
  const saved = readSaved(storage(), key);
  if (saved) return Promise.resolve(saved);
  let p = inFlight.get(key);
  if (!p) {
    p = unwrap(siApi.v1["explain-month"].$post({ json: req })).then((d) => {
      save(storage(), key, d.text);
      return d.text;
    });
    p.catch(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return p;
}

type Props = {
  pick: RotationOption;
  a: RotationOption | undefined;
  isA: boolean;
  name: (id: string) => string;
  cropById: (id: string) => Crop | undefined;
  monthly: Pick<LotData["monthly"], "precip_mm" | "et0_mm">;
  /** During a what-if the SI note waits; the engine lines still show. */
  whatIf: boolean;
};

export function YearStrip({ pick, a, isA, name, cropById, monthly, whatIf }: Props) {
  const [months] = useState(() => stripMonths(new Date(), BACK));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const x = useRef(0);
  const [active, setActive] = useState(BACK);
  const rows: { label: string; strip: (string | null)[] }[] = [
    { label: isA ? "Your crops" : "Suggestion", strip: yearStrip(pick) },
    ...(!isA && a ? [{ label: "You now", strip: yearStrip(a) }] : []),
  ];
  const by = (dx: number) => scroll.current?.scrollTo({ x: Math.max(0, x.current + dx * STEP), animated: true });

  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        {/* Row names: they stay while the months scroll. */}
        <View style={styles.labels}>
          <View style={styles.headSpace} />
          {rows.map((r) => (
            <Text key={r.label} style={[text.small, styles.rowLabel]} numberOfLines={1}>
              {r.label}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator
          onLayout={() => scroll.current?.scrollTo({ x: (BACK - 1) * STEP, animated: false })}
          onScroll={(e) => (x.current = e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
          style={styles.flex}
          contentContainerStyle={styles.cols}
        >
          {months.map((m, i) => (
            <MonthColumn key={i} m={m} rows={rows} cropById={cropById} on={i === active} onPick={() => setActive(i)} />
          ))}
        </ScrollView>
      </View>
      <View style={styles.nav}>
        <Pressable onPress={() => by(-6)} accessibilityRole="button" accessibilityLabel="Earlier months" style={styles.navBtn}>
          <Icon name="back" size={18} color={colors.green} />
          <Text style={styles.navText}>Earlier</Text>
        </Pressable>
        <Text style={[text.caption, styles.flex, styles.center]}>Drag or use the arrows. The plan repeats every year.</Text>
        <Pressable onPress={() => by(6)} accessibilityRole="button" accessibilityLabel="Later months" style={styles.navBtn}>
          <Text style={styles.navText}>Later</Text>
          <Icon name="chevron" size={18} color={colors.green} />
        </Pressable>
      </View>
      <MonthNote m={months[active]} pick={pick} a={isA ? undefined : a} name={name} monthly={monthly} whatIf={whatIf} />
    </View>
  );
}

function MonthColumn({
  m,
  rows,
  cropById,
  on,
  onPick,
}: {
  m: StripMonth;
  rows: { label: string; strip: (string | null)[] }[];
  cropById: (id: string) => Crop | undefined;
  on: boolean;
  onPick: () => void;
}) {
  const showYear = m.month === 0 || m.when === "now";
  return (
    <Pressable
      onPress={onPick}
      onHoverIn={onPick}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${MONTH_LONG[m.month]} ${m.year}${m.when === "now" ? ", this month" : ""}`}
      style={[styles.col, m.month === 0 && styles.newYear, m.when === "past" && styles.past]}
    >
      <Text style={styles.year}>{showYear ? String(m.year) : " "}</Text>
      <Text style={[styles.letter, m.when === "now" && styles.letterNow, on && styles.letterOn]}>{MONTH_NAMES[m.month]}</Text>
      {rows.map((r) => {
        const id = r.strip[m.month];
        const st = id ? familyStyle(cropById(id)?.family) : null;
        return (
          <View
            key={r.label}
            style={[styles.cell, st ? { backgroundColor: st.fill } : styles.cellEmpty, m.when === "now" && styles.cellNow, on && styles.cellOn]}
          />
        );
      })}
    </Pressable>
  );
}

function MonthNote({
  m,
  pick,
  a,
  name,
  monthly,
  whatIf,
}: {
  m: StripMonth;
  pick: RotationOption;
  a: RotationOption | undefined;
  name: (id: string) => string;
  monthly: Props["monthly"];
  whatIf: boolean;
}) {
  const online = useOnline();
  const req = explainMonthRequest({ month: m.month, pick, a, monthly, name });
  const key = JSON.stringify(req);
  const saved = readSaved(storage(), key);
  // Fetched answers (or a failure) by request; a saved answer needs no state.
  const [si, setSi] = useState<{ key: string; text: string | null }>({ key: "", text: null });
  const wanted = !whatIf && online && !saved;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    // A short wait, so moving the mouse across the strip does not ask about every month on the way.
    const t = setTimeout(() => {
      askMonth(req).then(
        (txt) => live && setSi({ key, text: txt }),
        () => live && setSi({ key, text: null }),
      );
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // `key` stands for `req`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted]);

  const mine = saved ? { text: saved, loading: false } : si.key === key ? { text: si.text, loading: false } : { text: null, loading: wanted };
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <Text style={text.bodyStrong}>
        {MONTH_LONG[m.month]} {m.year}
        {m.when === "now" ? " (this month)" : ""}
      </Text>
      <Text style={text.small}>
        <Text style={styles.noteLabel}>{a ? "Suggestion: " : ""}</Text>
        {monthLines(pick, m.month, name).join(" ")}
      </Text>
      {a ? (
        <Text style={text.small}>
          <Text style={styles.noteLabel}>You now: </Text>
          {monthLines(a, m.month, name).join(" ")}
        </Text>
      ) : null}
      {mine.loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={text.caption}>SI is looking at this month…</Text>
        </View>
      ) : mine.text ? (
        <View style={styles.si}>
          <Text style={text.small}>{mine.text}</Text>
          <Text style={text.caption}>{"Why, by SI (Claude, by Anthropic) from this lot's NASA rain for the month. It can be wrong."}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  frame: { flexDirection: "row" },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  labels: { width: 84, gap: GAP, paddingRight: space.xs },
  headSpace: { height: 34 },
  rowLabel: { height: 26, lineHeight: 26 },
  cols: { gap: GAP, paddingBottom: space.xs },
  col: { width: CELL, gap: GAP, alignItems: "stretch", borderRadius: 4 },
  newYear: { marginLeft: 6 },
  past: { opacity: 0.55 },
  year: { fontSize: 11, lineHeight: 14, fontWeight: "700", color: colors.ink, width: 48 },
  letter: { fontSize: 12, lineHeight: 16, height: 16, textAlign: "center", color: colors.muted },
  letterNow: { color: colors.green, fontWeight: "800" },
  letterOn: { color: colors.ink, fontWeight: "800", textDecorationLine: "underline" },
  cell: { height: 26, borderRadius: 4 },
  cellEmpty: { backgroundColor: colors.bg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.dashed },
  cellNow: { borderWidth: 2, borderStyle: "solid", borderColor: colors.ink },
  cellOn: { transform: [{ scaleY: 1.08 }] },
  nav: { flexDirection: "row", alignItems: "center", gap: space.sm },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 40, paddingHorizontal: space.xs },
  navText: { fontSize: 14, fontWeight: "700", color: colors.green },
  note: { gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  noteLabel: { fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  si: { gap: 2, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: colors.border },
});
