/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#d4af37",
          classic: "#d4af37",
          bright: "#e8d5a3",
          dim: "#8a6d3b",
          glow: "rgba(212, 175, 55, 0.38)",
        },
        bronze: {
          DEFAULT: "#8B6B3F",
          muted: "#5c4a32",
        },
        abyss: {
          bg: "#000000",
          deep: "#050505",
          card: "#121212",
          elevated: "#181818",
          panel: "rgba(18, 18, 18, 0.88)",
        },
        rare: "#7c6b9e",
      },
      fontFamily: {
        serif: ["Cinzel", "Georgia", "serif"],
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      borderRadius: {
        zernix: "6px",
      },
      boxShadow: {
        goldGlow: "0 0 18px rgba(197, 160, 89, 0.28), 0 0 1px rgba(197, 160, 89, 0.45)",
        innerGold:
          "inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.45)",
        innerGoldRing: "inset 0 0 0 1px rgba(197, 160, 89, 0.22)",
        cardLift: "0 12px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(197, 160, 89, 0.12)",
        panelEdge: "0 0 0 1px rgba(197, 160, 89, 0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "gold-btn":
          "linear-gradient(to bottom, #d4af37 0%, #8a6d3b 100%)",
        summon:
          "linear-gradient(165deg, #2d6a4f 0%, #1b4332 55%, #0f2e22 100%)",
        parchment:
          "linear-gradient(145deg, #e8dcc4 0%, #d4c4a8 40%, #c4ae8f 100%)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.35s ease-out forwards",
      },
    },
  },
  plugins: [],
};
