const { defineConfig } = require('electron-vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: { input: 'src/preload/index.ts' },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: { input: 'src/renderer/index.html' },
    },
  },
}); 