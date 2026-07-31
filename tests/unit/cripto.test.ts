import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import {
  ErroDeConfiguracaoCripto,
  ErroDeDecifragem,
  cifrar,
  criptoConfigurada,
  decifrar,
} from "@/lib/cripto";

/**
 * Cifragem da chave PIX em repouso. O que precisa ficar provado: reversibilidade,
 * detecção de adulteração (é cifra autenticada) e erro claro de configuração — não
 * silencioso, porque falhar em cifrar dado sensível não pode passar batido.
 */

const CHAVE_ORIGINAL = process.env.PIX_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.PIX_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterAll(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.PIX_ENCRYPTION_KEY;
  else process.env.PIX_ENCRYPTION_KEY = CHAVE_ORIGINAL;
});

describe("cifrar/decifrar", () => {
  it("devolve o valor original", () => {
    const chavePix = "ana@exemplo.com";
    expect(decifrar(cifrar(chavePix))).toBe(chavePix);
  });

  it("preserva acentos e caracteres especiais", () => {
    const v = "joão+pix@açaí.com.br";
    expect(decifrar(cifrar(v))).toBe(v);
  });

  it("mesma entrada gera saídas diferentes (IV aleatório)", () => {
    const a = cifrar("11122233344");
    const b = cifrar("11122233344");
    expect(a).not.toBe(b);
    expect(decifrar(a)).toBe(decifrar(b));
  });

  it("usa o formato versionado v1.iv.tag.dados", () => {
    const partes = cifrar("x").split(".");
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe("v1");
  });

  it("detecta adulteração dos dados", () => {
    const pacote = cifrar("+5561988880000");
    const partes = pacote.split(".");
    partes[3] = Buffer.from("outro valor").toString("base64url");
    expect(() => decifrar(partes.join("."))).toThrow(ErroDeDecifragem);
  });

  it("detecta adulteração da tag de autenticação", () => {
    const partes = cifrar("segredo").split(".");
    partes[2] = Buffer.from(randomBytes(16)).toString("base64url");
    expect(() => decifrar(partes.join("."))).toThrow(ErroDeDecifragem);
  });

  it("recusa pacote em formato desconhecido", () => {
    expect(() => decifrar("texto puro")).toThrow(ErroDeDecifragem);
    expect(() => decifrar("v2.a.b.c")).toThrow(ErroDeDecifragem);
  });

  it("não decifra com outra chave", () => {
    const pacote = cifrar("11122233344");
    process.env.PIX_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decifrar(pacote)).toThrow(ErroDeDecifragem);
  });
});

describe("configuração", () => {
  it("chave ausente é erro de configuração com instrução de correção", () => {
    delete process.env.PIX_ENCRYPTION_KEY;
    expect(criptoConfigurada()).toBe(false);
    expect(() => cifrar("x")).toThrow(ErroDeConfiguracaoCripto);
    expect(() => cifrar("x")).toThrow(/openssl rand -base64 32/);
  });

  it("chave com tamanho errado é recusada", () => {
    process.env.PIX_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    expect(() => cifrar("x")).toThrow(/32 bytes/);
    process.env.PIX_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(criptoConfigurada()).toBe(true);
  });
});
