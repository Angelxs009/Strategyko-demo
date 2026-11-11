import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Los archivos comparten la misma base de datos de pruebas: se ejecutan de a uno.
    fileParallelism: false,
  },
});
