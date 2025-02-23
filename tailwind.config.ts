import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        dark: "var(--dark)",
        light: "var(--light)",
      },
      fontSize: {
        'header': ['2rem', '150%'],    // 32px
        'button': ['1.125rem', '150%'], // 18px
        'body': ['0.875rem', '150%'],   // 14px
      },
      fontFamily: {
        sans: ['var(--font-primary)', 'sans-serif'],
      },
      scale: {
        '102': '1.02',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-delay': {
          '0%, 50%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '0.8', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'fade-in-delay': 'fade-in-delay 1s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
