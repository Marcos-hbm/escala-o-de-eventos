/**
 * Cifragem de dados sensíveis em repouso (AES-256-GCM).
 *
 * ## Por que existe
 *
 * A chave PIX do trabalhador é dado pessoal (LGPD) e a especificação exige que a
 * empresa consiga vê-la para pagar. Guardar em texto puro significaria que
 * qualquer cópia do banco — backup, dump de suporte, log de query — entrega as
 * chaves de todos os trabalhadores. Cifrando na aplicação, o vazamento do banco
 * sozinho não basta: é preciso também a chave de cifragem, que vive em variável de
 * ambiente.
 *
 * ## Escolhas
 *
 * - **AES-256-GCM**: cifra autenticada. Além de esconder, detecta adulteração — se
 *   alguém trocar bytes na coluna, `decifrar` falha em vez de devolver lixo.
 * - **IV aleatório de 12 bytes por operação** (recomendação do NIST para GCM):
 *   cifrar o mesmo valor duas vezes produz saídas diferentes, então a coluna não
 *   revela quem compartilha a mesma chave PIX.
 * - **Formato `v1.iv.tag.dados`** em base64url, com prefixo de versão para permitir
 *   rotação de algoritmo/chave sem adivinhação.
 *
 * Não é hash: precisa ser reversível para a empresa pagar. Senhas continuam em
 * bcrypt (`lib/auth.ts`), que é irreversível de propósito.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const VERSAO = "v1";
const TAMANHO_IV = 12; // bytes — padrão para GCM
const TAMANHO_CHAVE = 32; // bytes = AES-256
const NOME_VAR = "PIX_ENCRYPTION_KEY";

/** Erro de configuração (chave ausente/curta) — separado de erro de dado. */
export class ErroDeConfiguracaoCripto extends Error {}
/** Erro ao decifrar: dado adulterado, truncado ou cifrado com outra chave. */
export class ErroDeDecifragem extends Error {}

function obterChave(): Buffer {
  const bruta = process.env[NOME_VAR];
  if (!bruta) {
    throw new ErroDeConfiguracaoCripto(
      `${NOME_VAR} ausente. Gere uma chave de 32 bytes em base64 e coloque no .env: openssl rand -base64 32`,
    );
  }
  const chave = Buffer.from(bruta, "base64");
  if (chave.length !== TAMANHO_CHAVE) {
    throw new ErroDeConfiguracaoCripto(
      `${NOME_VAR} deve ter exatamente ${TAMANHO_CHAVE} bytes depois do base64 (tem ${chave.length}). Gere com: openssl rand -base64 32`,
    );
  }
  return chave;
}

/** `true` se a cifragem está configurada — para a UI orientar em vez de estourar. */
export function criptoConfigurada(): boolean {
  try {
    obterChave();
    return true;
  } catch {
    return false;
  }
}

/** Cifra um texto. Saída: `v1.<iv>.<tag>.<dados>` em base64url. */
export function cifrar(textoPuro: string): string {
  const chave = obterChave();
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave, iv);
  const dados = Buffer.concat([cipher.update(textoPuro, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSAO, b64(iv), b64(tag), b64(dados)].join(".");
}

/** Decifra o pacote produzido por `cifrar`. Lança `ErroDeDecifragem` se inválido. */
export function decifrar(pacote: string): string {
  const partes = pacote.split(".");
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new ErroDeDecifragem(
      `Pacote cifrado em formato inesperado (esperado "${VERSAO}.iv.tag.dados"). Valor gravado com outra versão do formato?`,
    );
  }
  const [, ivB64, tagB64, dadosB64] = partes;
  try {
    const decipher = createDecipheriv(ALGORITMO, obterChave(), debase64(ivB64));
    decipher.setAuthTag(debase64(tagB64));
    return Buffer.concat([decipher.update(debase64(dadosB64)), decipher.final()]).toString("utf8");
  } catch (e) {
    if (e instanceof ErroDeConfiguracaoCripto) throw e;
    throw new ErroDeDecifragem(
      "Falha ao decifrar: dado adulterado, truncado ou cifrado com outra chave (PIX_ENCRYPTION_KEY diferente da usada ao gravar).",
    );
  }
}

function b64(b: Buffer): string {
  return b.toString("base64url");
}

function debase64(s: string): Buffer {
  return Buffer.from(s, "base64url");
}
