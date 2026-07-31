/**
 * Setup dos testes de integração: carrega o `.env` (DATABASE_URL e
 * PIX_ENCRYPTION_KEY) do jeito que o Next carregaria.
 *
 * Diferente dos unitários, estes testes tocam o PostgreSQL real — é o único lugar
 * onde CHECK constraints e índices parciais podem ser verificados de verdade.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const arquivo = path.resolve(process.cwd(), ".env");
try {
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m) continue;
    const [, chave, bruto] = m;
    if (process.env[chave]) continue;
    process.env[chave] = bruto.replace(/^["']|["']$/g, "");
  }
} catch {
  console.warn(`[integração] .env não encontrado em ${arquivo}; usando variáveis do ambiente.`);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL ausente: testes de integração precisam do PostgreSQL (npm run db:up ou docker compose up -d).",
  );
}
