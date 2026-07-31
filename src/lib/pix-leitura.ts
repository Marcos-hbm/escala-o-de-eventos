import "server-only";
import { prisma } from "./prisma";
import { registrarAuditoria } from "./audit";
import { decifrar, criptoConfigurada, ErroDeDecifragem } from "./cripto";
import { formatarChavePix, mascararChavePix, type TipoChavePixId } from "./pix";

/**
 * Leitura da chave PIX do trabalhador pela empresa — **com auditoria obrigatória**.
 *
 * Este é o único caminho que decifra a chave. Exigências acumuladas aqui, para que
 * nenhuma tela possa esquecer uma delas:
 *
 * 1. quem lê precisa de permissão financeira (`pix:ver`), verificada por quem chama;
 * 2. o trabalhador precisa ter **vínculo com a empresa** e estar **escalado** em um
 *    evento dela — não existe "listar chaves PIX de todo mundo";
 * 3. toda leitura vira `AuditLog` com o membro que leu (item 13 da especificação).
 *
 * O trabalhador, no próprio perfil, vê a versão mascarada (`chavePixMascarada`), que
 * não passa por auditoria por não expor o valor.
 */

export interface ChavePixVisivel {
  tipo: TipoChavePixId;
  /** Valor completo, para copiar. */
  valor: string;
  /** Valor formatado para exibição. */
  formatado: string;
}

export type ResultadoChavePixVisivel =
  | { ok: true; chave: ChavePixVisivel }
  | { ok: false; motivo: "sem_chave" | "sem_vinculo" | "cripto_indisponivel" | "falha_decifragem"; mensagem: string };

/**
 * Decifra a chave PIX de um trabalhador para a empresa pagar, registrando a leitura.
 * `membroId` é quem está lendo (vai para a auditoria).
 */
export async function lerChavePixParaEmpresa(params: {
  empresaId: number;
  userId: number;
  membroId?: number;
  membroNome?: string;
  /** Evento em que o trabalhador está escalado (contexto do pagamento). */
  eventoId?: number;
}): Promise<ResultadoChavePixVisivel> {
  const { empresaId, userId } = params;

  if (!criptoConfigurada()) {
    return {
      ok: false,
      motivo: "cripto_indisponivel",
      mensagem:
        "Chave de cifragem não configurada no servidor (PIX_ENCRYPTION_KEY). Sem ela o sistema não decifra chaves PIX.",
    };
  }

  // O trabalhador precisa estar escalado em algum evento desta empresa — é o que
  // justifica a empresa ver a chave.
  const escalado = await prisma.inscricao.count({
    where: {
      userId,
      status: { in: ["ESCALADO", "PRESENTE", "FALTA"] },
      evento: { empresaId, ...(params.eventoId ? { id: params.eventoId } : {}) },
    },
  });
  if (escalado === 0) {
    return {
      ok: false,
      motivo: "sem_vinculo",
      mensagem: "A chave PIX só fica visível para empresas em que o trabalhador foi escalado.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pixTipo: true, pixChaveCifrada: true, nome: true },
  });
  if (!user?.pixTipo || !user.pixChaveCifrada) {
    return {
      ok: false,
      motivo: "sem_chave",
      mensagem: "O trabalhador ainda não cadastrou chave PIX. Combine outra forma de pagamento.",
    };
  }

  let valor: string;
  try {
    valor = decifrar(user.pixChaveCifrada);
  } catch (e) {
    // Falha aqui é problema de configuração/dado, não do usuário: registra e avisa.
    console.error("[pix] falha ao decifrar chave", e);
    return {
      ok: false,
      motivo: "falha_decifragem",
      mensagem:
        e instanceof ErroDeDecifragem
          ? "Não foi possível ler a chave PIX cadastrada (dado inconsistente). Peça ao trabalhador para cadastrar novamente."
          : "Não foi possível ler a chave PIX agora.",
    };
  }

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: empresaId,
    acao: "PIX_VISUALIZADO",
    entidade: "User",
    entidadeId: userId,
    detalhe: [
      params.membroNome ? `por ${params.membroNome}` : null,
      params.eventoId ? `evento ${params.eventoId}` : null,
      `chave ${user.pixTipo}`,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  return {
    ok: true,
    chave: { tipo: user.pixTipo, valor, formatado: formatarChavePix(user.pixTipo, valor) },
  };
}

/**
 * Versão mascarada para o próprio trabalhador conferir o que está cadastrado.
 * Não audita: não expõe o valor.
 */
export async function chavePixMascarada(userId: number): Promise<{ tipo: TipoChavePixId; mascara: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pixTipo: true, pixChaveCifrada: true },
  });
  if (!user?.pixTipo || !user.pixChaveCifrada || !criptoConfigurada()) return null;
  try {
    return { tipo: user.pixTipo, mascara: mascararChavePix(user.pixTipo, decifrar(user.pixChaveCifrada)) };
  } catch {
    return null;
  }
}
