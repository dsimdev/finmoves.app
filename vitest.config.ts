import { defineConfig } from "vitest/config";

// Tests unitarios de la lógica pura (utils/*, helpers de formato). Node env, sin DOM.
// Resuelve el alias @/ nativamente desde tsconfig. Correr con `npm test`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
