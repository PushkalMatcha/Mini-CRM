/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F0F0F", // Midnight velvet
        foreground: "#F5F5F5", // Editorial cream white
        card: {
          DEFAULT: "#1A1A1A", // Luxury editorial surface
          foreground: "#F5F5F5",
        },
        primary: {
          DEFAULT: "#C9A96E", // Warm gold accent
          hover: "#B5945B",
        },
        secondary: {
          DEFAULT: "#8C8C8C", // Balanced editorial grey
          hover: "#737373",
        },
        border: "#2A2A2A", // Slate charcoal border
        muted: {
          DEFAULT: "#A3A3A3",
          foreground: "#525252"
        }
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Outfit", "Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
