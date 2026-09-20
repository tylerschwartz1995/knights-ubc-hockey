import { createContext, useContext } from "react";

export const DARK = {
  bg: "#151311",
  surface: "#1c1a17",
  surfaceLight: "#222019",
  border: "#2e2a21",
  gold: "#c9a84c",
  goldBright: "#dfc06a",
  goldMuted: "#8a7a52",
  goldDim: "#5c5238",
  text: "#e8e0cc",
  textMid: "#a89d85",
  textDim: "#6b6352",
  textFaint: "#3d3830",
};

export const LIGHT = {
  bg: "#f5f2eb",
  surface: "#ffffff",
  surfaceLight: "#faf8f4",
  border: "#e0d9c8",
  gold: "#9a7b2e",
  goldBright: "#7a6020",
  goldMuted: "#a89060",
  goldDim: "#c4b68e",
  text: "#1a1710",
  textMid: "#4a4435",
  textDim: "#7a7060",
  textFaint: "#c0b8a8",
};

export const ThemeContext = createContext(DARK);
export const useTheme = () => useContext(ThemeContext);
export const plainButton = { background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", letterSpacing: "inherit", textAlign: "inherit", cursor: "pointer" };

