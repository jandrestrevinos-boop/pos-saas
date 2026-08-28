import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0A0F2E", 800: "#141B3D", line: "#232B55", DEFAULT: "#0F172A" },
        paper: { DEFAULT: "#F7F9FC", raised: "#FFFFFF" },
        line: "#E2E8F0",
        ember: { DEFAULT: "#0038FF", dark: "#0026B8" },
        marigold: "#00B4D8",
        sage: { DEFAULT: "#3F7D20", light: "#EAF3DE" },
        muted: "#64748B",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
