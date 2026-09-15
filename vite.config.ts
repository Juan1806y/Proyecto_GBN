import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // En producción la aplicación se publica en GitHub Pages bajo la ruta del
  // repositorio (https://juan1806y.github.io/Proyecto_GBN/), así que los
  // recursos deben resolverse desde ahí. En desarrollo se sirve en la raíz.
  base: command === 'build' ? '/Proyecto_GBN/' : '/',
}))
