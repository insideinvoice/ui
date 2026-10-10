/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  // line-clamp is built into Tailwind >= 3.3; the standalone plugin is redundant.
  plugins: [],
};
