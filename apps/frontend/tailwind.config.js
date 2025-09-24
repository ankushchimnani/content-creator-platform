/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6366F1",
        "background-light": "#F9FAFB",
        "background-dark": "#111827",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1F2937",
        "card-light": "#FFFFFF",
        "card-dark": "#1F2937",
        "text-light": "#1F2937",
        "text-dark": "#F9FAFB",
        "text-secondary-light": "#6B7280",
        "text-secondary-dark": "#9CA3AF",
        "subtle-light": "#6B7280",
        "subtle-dark": "#9CA3AF",
        "border-light": "#E5E7EB",
        "border-dark": "#374151",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
