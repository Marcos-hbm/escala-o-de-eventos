import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda de regressão de uma decisão medida, não de estilo.
 *
 * `loading.tsx` cria uma fronteira de streaming no segmento. Em duas telas isso era
 * condição necessária para o defeito "mutação gravada, tela velha":
 *
 * | Tela | Com `loading.tsx` | Sem |
 * | --- | --- | --- |
 * | `/empresa/plano` (trocar plano) | 4 de 16 | 0 de 48 |
 * | `/empresa/vinculos` (convidar) | 5 de 64 | 0 de 64 |
 *
 * Nas telas de Equipe e Notificações, que também têm `loading.tsx` e formulário
 * mutante, o defeito **não** reproduziu (0 de 64 cada) — o skeleton continua lá.
 * Medição completa e hipóteses descartadas em
 * `docs/adr/0004-atualizacao-de-tela-apos-server-action.md`.
 *
 * A correção é a **ausência** de um arquivo, invisível numa revisão de código; daí
 * este teste.
 */
describe("fronteiras de streaming (loading.tsx)", () => {
  const raiz = resolve(__dirname, "../../src/app");
  const semSkeleton = ["empresa/plano", "empresa/vinculos"];
  const comSkeleton = [
    "empresa/dashboard",
    "trabalhador/dashboard",
    "empresa/equipe",
    "trabalhador/notificacoes",
  ];

  it.each(semSkeleton)("%s não tem loading.tsx (ADR 0004)", (rota) => {
    expect(existsSync(resolve(raiz, rota, "loading.tsx"))).toBe(false);
  });

  it.each(comSkeleton)("%s mantém o skeleton", (rota) => {
    expect(existsSync(resolve(raiz, rota, "loading.tsx"))).toBe(true);
  });
});
