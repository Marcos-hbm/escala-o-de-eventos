/**
 * Stub de `server-only` para os testes de integração.
 *
 * O pacote real existe para estourar em build de cliente. Sob o Vitest (Node puro)
 * ele também estoura, o que impediria testar módulos de servidor como
 * `lib/pix-leitura.ts` — que é justamente onde estão a autorização e a auditoria
 * da chave PIX. O alias está em `vitest.config.ts`.
 */
export {};
