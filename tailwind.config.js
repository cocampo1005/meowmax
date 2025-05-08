/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primaryLightPurple: "#F9F4FF", // Primary background light purple
        primaryDarkPurple: "#4E2C62", // Primary dark purple for text
        secondaryPurple: "#8764B5", // Secondary purple for darker backgrounds
        tertiaryPurple: "#D8CBE6", // Tertiary purple for lighter purple backgrounds
        disabledPurple: "#75657E", // Disabled purple for disabled buttons
        accentPurple: "#631C8C", // Accent purple for buttons
        primaryWhite: "#FFFFFF", // Primary light for text
        errorRed: "#F292A7", // Secondary pink for error backgrounds
        successGreen: "#95CF8A", // Success green for success messages
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        accent: ["Abel", "sans-serif"],
      },
    },
  },
  plugins: [],
};
