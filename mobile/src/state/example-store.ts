import { createPersistedStore } from "./create-persisted-store";

// Example of the pattern only. Copy it for feature stores (e.g. lots, crops).
type ExampleState = {
  launches: number;
  recordLaunch: () => void;
  reset: () => void;
};

export const useExampleStore = createPersistedStore<ExampleState>("example", (set) => ({
  launches: 0,
  recordLaunch: () => set((s) => ({ launches: s.launches + 1 })),
  reset: () => set({ launches: 0 }),
}));
