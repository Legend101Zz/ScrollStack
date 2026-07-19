/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        shell: "var(--ss-color-shell)",
        ink: {
          DEFAULT: "var(--ss-color-ink)",
          raised: "var(--ss-color-ink-raised)",
          soft: "var(--ss-color-ink-soft)",
        },
        paper: {
          DEFAULT: "var(--ss-color-paper)",
          soft: "var(--ss-color-paper-soft)",
          high: "var(--ss-color-paper-high)",
        },
        accent: {
          DEFAULT: "var(--ss-color-accent)",
          deep: "var(--ss-color-accent-deep)",
          soft: "var(--ss-color-accent-soft)",
        },
        tone: "var(--ss-color-tone)",
        copy: {
          DEFAULT: "var(--ss-color-text-primary)",
          secondary: "var(--ss-color-text-secondary)",
          muted: "var(--ss-color-text-muted)",
          paper: "var(--ss-color-paper-text)",
          "paper-muted": "var(--ss-color-paper-muted)",
        },
        danger: "var(--ss-color-danger)",
      },
      fontFamily: {
        display: ["var(--ss-font-display)"],
        ui: ["var(--ss-font-ui)"],
      },
      borderRadius: {
        input: "var(--ss-radius-input)",
        panel: "var(--ss-radius-panel)",
        control: "var(--ss-radius-control)",
      },
      transitionDuration: {
        quick: "var(--ss-motion-quick)",
        base: "var(--ss-motion-base)",
        slow: "var(--ss-motion-slow)",
      },
      transitionTimingFunction: {
        authored: "var(--ss-ease-out)",
      },
      boxShadow: {
        paper: "0 28px 70px -34px rgb(8 5 3 / 78%)",
        chrome: "0 14px 36px -18px rgb(5 3 2 / 90%)",
      },
      maxWidth: {
        frame: "87.5rem",
      },
    },
  },
};
