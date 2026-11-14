import { create } from "zustand";

// A counter bumped when saved climate data changes without a status change (for example the
// NASA SRTM elevation added to a lot that was already ready), so screens read it again.
export const useLotDataRev = create<{ rev: number; bump: () => void }>((set) => ({
  rev: 0,
  bump: () => set((s) => ({ rev: s.rev + 1 })),
}));
