import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  return {
    plugins: [solidPlugin(), tsconfigPaths()],
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    }
  };
});
