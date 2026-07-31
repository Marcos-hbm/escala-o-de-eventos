import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Unitários: puros, sem banco. Integração: PostgreSQL real (CHECK constraints,
    // índices parciais, auditoria) — ver tests/integration/setup.ts.
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    // Testes de integração compartilham o banco: rodar em série evita colisão de
    // dados entre arquivos.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Permite importar módulos marcados como "server-only" sob o Node do Vitest.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
