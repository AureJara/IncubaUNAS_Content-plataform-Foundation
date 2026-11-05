// Mismo procesamiento que el sitio del equipo de frontend (@astrojs/tailwind: Tailwind 3 + autoprefixer),
// sin la integración, que aún no soporta Astro 7. Ver docs/adr/0007.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
