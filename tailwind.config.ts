import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#0f172a",
        brand: {
          50: "#e6f5f3",
          100: "#c4ebe7",
          200: "#9bdad3",
          300: "#6bc1b8",
          400: "#3aa59c",
          500: "#1a8b82",
          600: "#006b5f",
          700: "#005248",
          800: "#014239",
          900: "#013530",
        },
      },
      fontFamily: {
        heading: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
