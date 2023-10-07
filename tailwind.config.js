/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'primary': '#3D55CC',
        'darkest': '#141933',
        'dark': '#505673',
        'medium': '#878CA8',
        'light': '#DADEF2',
        'lightest': '#F5F6FA',
        'white': '#FFFFFF'
      }
    },
    spacing: {
      'xs': '8pt',
      'sm': '16pt',
      'md': '24pt',
      'lg': '32pt',
      'xl': '48pt',
      'xxl': '80pt'
    },
    borderRadius: {
      'sm': '8pt',
      'md': '16pt',
      'lg': '32pt'
    }
  },
};
