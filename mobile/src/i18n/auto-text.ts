import { Text } from "react-native";

import { tr } from "./lang-store";

// Every text on screen in the chosen language (2026-11-15): plain text children of <Text> are looked
// up in the dictionary when they are drawn, so no screen needs its own changes. Text that is not in
// the dictionary (for example a sentence built with numbers) stays in English.

/** Keeps the spaces around a piece of text, translates the words in between. */
function one(s: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!m || !m[2]) return s;
  return m[1] + tr(m[2].replace(/\s+/g, " ")) + m[3];
}

function translateChildren(children: unknown): unknown {
  if (typeof children === "string") return one(children);
  if (Array.isArray(children)) return children.map((c) => (typeof c === "string" ? one(c) : c));
  return children;
}

type Renderable = { render?: (props: Record<string, unknown>, ref: unknown) => unknown; __trPatched?: boolean };

/** Called once at launch, before the first screen draws. */
export function patchTextForTranslation(): void {
  const T = Text as unknown as Renderable;
  if (!T.render || T.__trPatched) return;
  const original = T.render;
  T.render = function render(this: unknown, props, ref) {
    return original.call(this, { ...props, children: translateChildren(props.children) }, ref);
  };
  T.__trPatched = true;
}
