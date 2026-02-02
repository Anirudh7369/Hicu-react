/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#a413ec",
        "background-light": "#f7f6f8",
        "background-dark": "#000000",
        "brand-gradient-start": "#6A0DAD",
        "brand-gradient-end": "#E60073",
        "field-bg": "#1C1C1E",
        "field-placeholder": "#8E8E93",
        "field-focus-ring": "#C8A2C8",
        "link-text": "#C8A2C8",
        "highlight": "#C8A2C8",
        "surface-dark": "#1C1C1E",
        "text-secondary-dark": "#8E8E93",
        "chat-bg": "#000000",
        "bubble-in": "#2C2C2E",
        "input-bg": "#1C1C1E",
        "accent-icon": "#A076F9",
        "gradient-start": "#6A11CB",
        "gradient-end": "#FC5C7D",
      },
      fontFamily: {
        "display": ["Plus Jakarta Sans", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "1rem",
        "lg": "2rem",
        "xl": "1.5rem",
        "full": "9999px"
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
