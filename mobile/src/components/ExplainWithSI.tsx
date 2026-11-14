import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { hc } from "hono/client";

import type { AppType } from "../../../api/types/index";
import { API_URL, ApiError, unwrap } from "../api/client";
import { fetchWithTimeout } from "../net/fetch";
import { useOnline } from "../net/useOnline";
import { Button } from "./Button";
import { explainErrorText, type ExplainRequest } from "./explain-core";
import { colors, radius, space, text } from "./theme";

// "Explain this plan with SI" (D33): a few plain sentences about the best plan, written by Claude
// from the engine's own results (explain-core.ts says what is sent). Labeled SI-generated, and the
// API drops any answer that holds a number the engine did not give. Needs signal; hidden offline.

/** The model can take a while to think, so this call gets longer than the API's usual 15 s. */
const siApi = hc<AppType>(API_URL, { fetch: (i: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(i, init, 60_000) });

type State = { kind: "idle" } | { kind: "loading" } | { kind: "done"; text: string } | { kind: "error"; message: string };

export function ExplainWithSI({ request }: { request: ExplainRequest }) {
  const online = useOnline();
  const [state, setState] = useState<State>({ kind: "idle" });
  if (!online && state.kind !== "done") return null;

  const ask = async () => {
    setState({ kind: "loading" });
    try {
      const data = await unwrap(siApi.v1.explain.$post({ json: request }));
      setState({ kind: "done", text: data.text });
    } catch (e) {
      setState({ kind: "error", message: explainErrorText(e instanceof ApiError ? e.code : "unknown") });
    }
  };

  if (state.kind === "done") {
    return (
      <View style={styles.box} accessibilityRole="summary">
        <Text style={styles.label}>SI-generated explanation (Claude, by Anthropic)</Text>
        <Text style={text.body}>{state.text}</Text>
        <Text style={text.caption}>
          Written by SI from the results above and checked so it uses only their numbers. It can still be wrong: talk it over
          with your agricultural technician.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {state.kind === "loading" ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.green} />
          <Text style={text.caption}>Writing a plain explanation…</Text>
        </View>
      ) : (
        <Button label="Explain this plan with SI" variant="secondary" icon="sprout" onPress={ask} />
      )}
      {state.kind === "error" ? (
        <Text style={text.caption} accessibilityLiveRegion="polite">
          {state.message}
        </Text>
      ) : null}
      {state.kind === "idle" ? (
        <Text style={text.caption}>Sends only these results, not where your farm is. Needs signal.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: "flex-start" },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  box: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: colors.greenTint },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.green },
});
