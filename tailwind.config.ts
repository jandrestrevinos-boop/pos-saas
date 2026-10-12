import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950-rgb) / <alpha-value>)",
          800: "#141B3D",
          line: "rgb(var(--ink-line-rgb) / <alpha-value>)",
          DEFAULT: "#0F172A",
        },
        paper: { DEFAULT: "#F7F9FC", raised: "#FFFFFF" },
        line: "#E2E8F0",
        ember: { DEFAULT: "rgb(var(--ember-rgb) / <alpha-value>)", dark: "rgb(var(--ember-dark-rgb) / <alpha-value>)" },
        marigold: "rgb(var(--marigold-rgb) / <alpha-value>)",
        sage: { DEFAULT: "#3F7D20", light: "#EAF3DE" },
        muted: "#64748B",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
