import type { CrystalIndex } from "../../shared/engine";
import type { Cut } from "../components/Gem";

export interface CrystalInfo {
  readonly colour: "blue" | "green" | "red" | "orange";
  readonly cut: Cut;
  readonly label: string;
  /** Square emoji used in the share grid. */
  readonly emoji: string;
  /** Pitch played on click: a pentatonic run (C5, E5, G5, A5) so any order sounds pleasant. */
  readonly hz: number;
}

export const CRYSTALS: Readonly<Record<CrystalIndex, CrystalInfo>> = {
  0: { colour: "blue", cut: "diamond", label: "Blue crystal", emoji: "🟦", hz: 523.25 },
  1: { colour: "green", cut: "emerald", label: "Green crystal", emoji: "🟩", hz: 659.25 },
  2: { colour: "red", cut: "round", label: "Red crystal", emoji: "🟥", hz: 783.99 },
  3: { colour: "orange", cut: "hex", label: "Orange crystal", emoji: "🟧", hz: 880 },
};
