import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { hc } from "hono/client";

import type { AppType } from "../../../api/types/index";
import { API_URL, ApiError, unwrap } from "../api/client";
import { fetchWithTimeout } from "../net/fetch";
import { useOnline } from "../net/useOnline";
import { Button } from "./Button";
import { SI_LINKS, SISource } from "./SISource";
import { explainErrorText, type ExplainRequest } from "./explain-core";
import { colors, radius, space, text } from "./theme";

// "In plain words" (D33): a few plain sentences about the suggested plan, written by Claude from
// the engine's own results (explain-core.ts says what is sent). Labeled SI-generated, and the API
// drops any answer that holds a number the engine did not give. Needs signal; hidden offline.
//
// `auto` (farmer-first dashboard): it loads by itself for the plan on screen, and if anything goes
// wrong it shows nothing, because the plain reasons on the card already stand on their own. Answers
// are kept for the visit, so going back and forth between lots doesn't ask again. During a what-if
// it is a button instead (`auto` false), so each tap on the what-if does not call the model.

/** The model can take a while to think, so this call gets longer than the API's usual 15 s. */
const siApi = hc<AppType>(API_URL, { fetch: (i: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(i, init, 60_000) });

/** Answers (or the request in flight) for this visit, by request. */
const answers = new Map<string, Promise<string>>();

function explain(request: ExplainRequest): Promise<string> {
  const key = JSON.stringify(request);
  let p = answers.get(key);
  if (!p) {
    p = unwrap(siApi.v1.explain.$post({ json: request })).then((d) => d.text);
    // A failed call is not kept, so the next visit can try again.
    p.catch(() => answers.delete(key));
    answers.set(key, p);
  }
  return p;
}

type State = { kind: "idle" } | { kind: "loading" } | { kind: "done"; text: string } | { kind: "error"; message: string };

export function ExplainWithSI({ request, auto = false, title = "In plain words" }: { request: ExplainRequest; auto?: boolean; title?: string }) {
  const online = useOnline();
  // Auto starts out loading; the parent keys this component by request, so a new plan starts fresh.
  const [state, setState] = useState<State>(() => (auto && online ? { kind: "loading" } : { kind: "idle" }));

  const ask = async (quiet: boolean) => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "done", text: await explain(request) });
    } catch (e) {
      setState(quiet ? { kind: "idle" } : { kind: "error", message: explainErrorText(e instanceof ApiError ? e.code : "unknown") });
    }
  };

  useEffect(() => {
    if (!auto || !online) return;
    let live = true;
    explain(request).then(
      (t) => live && setState({ kind: "done", text: t }),
      () => live && setState({ kind: "idle" }),
    );
    return () => {
      live = false;
    };
    // Keyed by request in the parent, so `request` is fixed for this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, online]);

  if (!online && state.kind !== "done") return null;

  if (state.kind === "done") {
    return (
      <View style={styles.box} accessibilityRole="summary">
        <Text style={styles.label}>{title}</Text>
        <Text style={text.body}>{state.text}</Text>
        <SISource
          lead="Written by SI (Claude, by Anthropic) from the app's results for this plan only. Talk it over with your technician."
          given={[
            `Plan: ${request.plan}. Crops: ${request.crops}`,
            `Score ${request.score ?? "not known"} out of 100${request.yourScore != null ? `, your crops ${request.yourScore}` : ""}.`,
            ...request.scores,
            ...request.why,
            ...request.tradeoffs,
            ...request.unknowns,
          ]}
          links={[SI_LINKS.power, SI_LINKS.fao56, SI_LINKS.ecocrop, SI_LINKS.claude]}
        />
      </View>
    );
  }
  if (auto) {
    // Quiet while it loads, nothing at all if it fails.
    return state.kind === "loading" ? (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.green} />
        <Text style={text.caption}>Writing it in plain words…</Text>
      </View>
    ) : null;
  }
  return (
    <View style={styles.wrap}>
      {state.kind === "loading" ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.green} />
          <Text style={text.caption}>Writing it in plain words…</Text>
        </View>
      ) : (
        <Button label="Explain this plan with SI" variant="secondary" icon="sprout" onPress={() => ask(false)} />
      )}
      {state.kind === "error" ? (
        <Text style={text.caption} accessibilityLiveRegion="polite">
          {state.message}
        </Text>
      ) : null}
      {state.kind === "idle" ? <Text style={text.caption}>Sends only these results, not where your farm is. Needs signal.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: "flex-start" },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  box: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: colors.greenTint },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.green },
});
