import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Mantienes los colores basados en variables si lo deseas */
        background: "var(--background)",
        foreground: "var(--foreground)",

        /* Colores adicionales para consistencia del diseño */
        primary: "#3b82f6",   // Azul moderno
        secondary: "#9333ea", // Morado vibrante
        accent: "#14b8a6",    // Verde turquesa
      },
    },
  },
  plugins: [],
} satisfies Config;
