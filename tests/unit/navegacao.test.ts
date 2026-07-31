import { describe, it, expect } from "vitest";
import { caminhoInternoDoReferer } from "@/lib/navegacao";

/**
 * O destino do redirecionamento pós-mutação vem de um header enviado pelo
 * navegador — ou seja, entrada não confiável. Aceitar qualquer valor abriria um
 * open redirect.
 */

describe("caminhoInternoDoReferer", () => {
  const origem = "http://localhost:3000";

  it("preserva caminho, filtros e paginação", () => {
    expect(caminhoInternoDoReferer("http://localhost:3000/empresa/eventos?q=festival&pagina=2", origem)).toBe(
      "/empresa/eventos?q=festival&pagina=2",
    );
  });

  it("recusa outra origem (open redirect)", () => {
    expect(caminhoInternoDoReferer("https://evil.example/phishing", origem)).toBeNull();
    expect(caminhoInternoDoReferer("http://localhost:9999/empresa/eventos", origem)).toBeNull();
  });

  it("recusa ausência e valores malformados", () => {
    expect(caminhoInternoDoReferer(null, origem)).toBeNull();
    expect(caminhoInternoDoReferer(undefined, origem)).toBeNull();
    expect(caminhoInternoDoReferer("", origem)).toBeNull();
    expect(caminhoInternoDoReferer("não é url", origem)).toBeNull();
    expect(caminhoInternoDoReferer("javascript:alert(1)", origem)).toBeNull();
  });

  it("sem origem conhecida, ainda exige caminho interno", () => {
    expect(caminhoInternoDoReferer("https://qualquer.site/empresa/eventos")).toBe("/empresa/eventos");
    expect(caminhoInternoDoReferer("data:text/html,oi")).toBeNull();
  });
});
