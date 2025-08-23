export default {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        brand: "var(--color-brand)",
        paper: "var(--color-paper)",
        yellow: "var(--color-yellow)",
        blue: "var(--color-blue)",
        pink: "var(--color-pink)",
        green: "var(--color-green)",
        lavender: "var(--color-lavender)",
        orange: "var(--color-orange)",
        vanilla: "var(--color-vanilla)",
        plum: "var(--color-plum)",
        gray: {
          100: "var(--gray-100)",
          200: "var(--gray-200)",
          300: "var(--gray-300)",
          400: "var(--gray-400)",
          500: "var(--gray-500)",
        },
      },
    },
  },
  plugins: [],
};
