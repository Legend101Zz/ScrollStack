import scrollStackPreset from "@scrollstack/design-tokens/tailwind-preset";

/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  presets: [scrollStackPreset],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "shell-radial":
          "radial-gradient(70rem 35rem at 18% -8%, #21170f 0%, var(--ss-color-shell) 58%)",
        screentone:
          "radial-gradient(rgb(22 16 12 / 32%) 1px, transparent 1.4px)",
        "screentone-light":
          "radial-gradient(rgb(179 160 129 / 16%) 1px, transparent 1.4px)",
        hatching:
          "repeating-linear-gradient(135deg, rgb(22 16 12 / 16%) 0 1px, transparent 1px 6px)",
      },
      backgroundSize: {
        tone: "5px 5px",
        "tone-shell": "7px 7px",
      },
      keyframes: {
        "ink-line": {
          "0%, 18%": { transform: "scaleX(0)", opacity: "0" },
          "48%, 88%": { transform: "scaleX(1)", opacity: "1" },
          "100%": { transform: "scaleX(0)", opacity: "0" },
        },
        "tone-settle": {
          "0%, 30%": { opacity: "0" },
          "54%, 90%": { opacity: "0.76" },
          "100%": { opacity: "0" },
        },
        "status-breathe": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.84)" },
        },
      },
      animation: {
        "ink-line": "ink-line 5.8s var(--ss-ease-out) infinite",
        "tone-settle": "tone-settle 5.8s var(--ss-ease-out) infinite",
        "status-breathe": "status-breathe 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default tailwindConfig;
