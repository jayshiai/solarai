import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderColor: {
        border: "hsl(var(--border))",
      },
      backgroundColor: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        card: "hsl(var(--card))",
        popover: "hsl(var(--popover))",
        destructive: "hsl(var(--destructive))",
      },
      textColor: {
        foreground: "hsl(var(--foreground))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        "card-foreground": "hsl(var(--card-foreground))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        destructive: "hsl(var(--destructive))",
      },
      ringColor: {
        ring: "hsl(var(--ring))",
      },
    },
  },
  plugins: [],
};
export default config;