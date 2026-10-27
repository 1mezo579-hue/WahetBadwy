import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "Tajawal", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#243B53",
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCCDC",
          300: "#9FB3C8",
          400: "#627D98",
          500: "#486581",
          600: "#334E68",
          700: "#243B53",
          800: "#1A2C3F",
          900: "#102A43",
          950: "#0B1D30",
        },
        slate: {
          50: "#F4F6F8",
          100: "#E9ECEF",
          200: "#D9E0E7",
          300: "#C4CDD5",
          400: "#9AA5B1",
          500: "#7B8794",
          600: "#5B6472",
          700: "#3E4C59",
          800: "#2D3748",
          900: "#1F2937",
          950: "#111827",
        },
        primary: {
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCCDC",
          300: "#9FB3C8",
          400: "#627D98",
          500: "#3B82A0",
          600: "#243B53",
          700: "#1A2C3F",
          800: "#102A43",
          900: "#0B1D30",
          950: "#06101B",
        },
        basiony: {
          bg: "#F4F6F8",
          card: "#FFFFFF",
          border: "#D9E0E7",
          text: "#1F2937",
          muted: "#5B6472",
          navy: "#243B53",
          accent: "#3B82A0",
          gold: "#D97706",
          success: "#237A57",
          successBg: "#EBF7F0",
          warning: "#946200",
          warningBg: "#FFFBEB",
          danger: "#B42318",
          dangerBg: "#FEF2F2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
