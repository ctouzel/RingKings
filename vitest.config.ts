import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les scripts de calibration ne font pas partie de la suite de tests normale.
    include: ['tests/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
