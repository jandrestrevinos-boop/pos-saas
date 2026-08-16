import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#14171F", 800: "#1E2330", line: "#2B3040", DEFAULT: "#1C1A17" },
        paper: { DEFAULT: "#FBF9F5", raised: "#FFFFFF" },
        line: "#E7E1D6",
        ember: { DEFAULT: "#E8562C", dark: "#C8431E" },
        marigold: "#F0A93B",
        sage: { DEFAULT: "#3F6152", light: "#EAF1ED" },
        muted: "#6B6459",
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
