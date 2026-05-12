/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          dim: "#8a7024",
          glow: "rgba(212, 175, 55, 0.35)",
        },
        abyss: {
          bg: "#0c0d10",
          card: "#14161c",
          elevated: "#1a1d26",
        },
        rare: "#7c6b9e",
      },
      fontFamily: {
        serif: ["Cinzel", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        goldGlow: "0 0 15px rgba(212, 175, 55, 0.3)",
        innerGold: "inset 0 0 0 1px rgba(212, 175, 55, 0.25)",
        cardLift: "0 8px 32px rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        "gold-btn":
          "linear-gradient(165deg, #d4af37 0%, #8a7024 50%, #5c4a17 100%)",
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
