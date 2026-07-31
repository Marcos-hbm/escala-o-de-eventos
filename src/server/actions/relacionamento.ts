"use server";

import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { voltarComErro, voltarComSucesso } from "@/server/actions/navegacao";
import { bloqueioSchema, desbloqueioSchema, favoritoSchema } from "@/lib/validations";
import { primeiroErroZod } from "@/lib/actions";

/**
 * v4 — Relacionamento empresa ↔ trabalhador (itens 4 e 5).
 *
 * Favoritar e bloquear são decisões da operação (papel COORDENADOR já basta), mas
 * **remover bloqueio** exige Administrador/Proprietário: a especificação diz "o
 * administrador poderá remover o bloqueio posteriormente", e quem bloqueou não
 * deveria poder desfazer sozinho o registro que justificou o bloqueio.
 *
 * Todas as ações redirecionam com o resultado na URL (ADR 0004) e gravam auditoria.
 */

const CAMINHO = "/empresa/relacionamento";

/** Confere que o trabalhador tem alguma relação com a empresa (vínculo ou escala). */
async function trabalhadorDaEmpresa(userId: number, empresaId: number) {
  const [vinculo, escala, user] = await Promise.all([
    prisma.vinculo.count({ where: { userId, empresaId } }),
    prisma.inscricao.count({ where: { userId, evento: { empresaId } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, nome: true } }),
  ]);
  if (!user || (vinculo === 0 && escala === 0)) return null;
  return user;
}

// --------------------------------------------------------------------------
// Favoritos (item 4)
// --------------------------------------------------------------------------
export async function favoritarTrabalhador(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "relacionamento:gerenciar");
  if (negado) return voltarComErro(CAMINHO, negado);

  const parsed = favoritoSchema.safeParse({
    userId: formData.get("userId"),
    observacao: formData.get("observacao"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO, primeiroErroZod(parsed.error));

  const user = await trabalhadorDaEmpresa(parsed.data.userId, s.sub);
  if (!user) return voltarComErro(CAMINHO, "Trabalhador não encontrado nesta empresa.");

  const existente = await prisma.trabalhadorFavorito.findUnique({
    where: { empresaId_userId: { empresaId: s.sub, userId: user.id } },
  });

  // Alterna: o mesmo botão favorita e desfavorita, como o usuário espera de uma
  // estrela. Sem isso seriam duas ações para o mesmo controle visual.
  if (existente) {
    await prisma.trabalhadorFavorito.delete({ where: { id: existente.id } });
    await registrarAuditoria({
      atorTipo: "EMPRESA",
      atorId: s.sub,
      acao: "FAVORITO_REMOVIDO",
      entidade: "User",
      entidadeId: user.id,
      detalhe: `${user.nome}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
    });
    return voltarComSucesso(CAMINHO, `${user.nome} saiu dos favoritos.`);
  }

  await prisma.trabalhadorFavorito.create({
    data: {
      empresaId: s.sub,
      userId: user.id,
      observacao: parsed.data.observacao || null,
      criadoPorMembroId: s.membroId ?? null,
    },
  });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "FAVORITO_ADICIONADO",
    entidade: "User",
    entidadeId: user.id,
    detalhe: `${user.nome}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });
  return voltarComSucesso(CAMINHO, `${user.nome} adicionado aos favoritos.`);
}

// --------------------------------------------------------------------------
// Bloqueio (item 5)
// --------------------------------------------------------------------------
export async function bloquearTrabalhador(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "relacionamento:gerenciar");
  if (negado) return voltarComErro(CAMINHO, negado);

  const parsed = bloqueioSchema.safeParse({
    userId: formData.get("userId"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO, primeiroErroZod(parsed.error));

  const user = await trabalhadorDaEmpresa(parsed.data.userId, s.sub);
  if (!user) return voltarComErro(CAMINHO, "Trabalhador não encontrado nesta empresa.");

  const vigente = await prisma.trabalhadorBloqueio.findFirst({
    where: { empresaId: s.sub, userId: user.id, removidoEm: null },
  });
  if (vigente) {
    return voltarComErro(CAMINHO, `${user.nome} já está bloqueado nesta empresa.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.trabalhadorBloqueio.create({
      data: {
        empresaId: s.sub,
        userId: user.id,
        motivo: parsed.data.motivo,
        aplicadoPorMembroId: s.membroId ?? null,
      },
    });

    // Bloquear encerra a relação corrente: o vínculo é desfeito e as inscrições
    // futuras caem. Deixar um vínculo ativo com bloqueio vigente seria estado
    // contraditório — e o trabalhador continuaria aparecendo na escala.
    await tx.vinculo.updateMany({
      where: { empresaId: s.sub, userId: user.id, status: { in: ["ATIVO", "PENDENTE"] } },
      data: { status: "DESVINCULADO", favorito: false },
    });
    await tx.inscricao.updateMany({
      where: {
        userId: user.id,
        status: { in: ["INSCRITO", "ESCALADO"] },
        evento: { empresaId: s.sub, dataEvento: { gte: new Date() } },
      },
      data: { status: "RECUSADO_EMPRESA" },
    });
    // Favorito e bloqueio ao mesmo tempo não faz sentido.
    await tx.trabalhadorFavorito.deleteMany({ where: { empresaId: s.sub, userId: user.id } });
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "TRABALHADOR_BLOQUEADO",
    entidade: "User",
    entidadeId: user.id,
    detalhe: `${user.nome}: ${parsed.data.motivo}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  return voltarComSucesso(
    CAMINHO,
    `${user.nome} foi bloqueado. Ele não verá novas vagas nem poderá se candidatar a esta empresa.`,
  );
}

/** Remoção do bloqueio — restrita a Administrador/Proprietário (item 5). */
export async function desbloquearTrabalhador(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "equipe:gerenciar");
  if (negado) {
    return voltarComErro(
      CAMINHO,
      "Somente Administrador ou Proprietário remove bloqueio — o registro do motivo existe para ser revisto por quem administra a conta.",
    );
  }

  const parsed = desbloqueioSchema.safeParse({
    bloqueioId: formData.get("bloqueioId"),
    motivoRemocao: formData.get("motivoRemocao"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO, primeiroErroZod(parsed.error));

  const bloqueio = await prisma.trabalhadorBloqueio.findFirst({
    where: { id: parsed.data.bloqueioId, empresaId: s.sub, removidoEm: null },
    include: { user: { select: { nome: true } } },
  });
  if (!bloqueio) return voltarComErro(CAMINHO, "Bloqueio não encontrado (ou já removido).");

  await prisma.trabalhadorBloqueio.update({
    where: { id: bloqueio.id },
    data: {
      removidoEm: new Date(),
      removidoPorMembroId: s.membroId ?? null,
      motivoRemocao: parsed.data.motivoRemocao || null,
    },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "TRABALHADOR_DESBLOQUEADO",
    entidade: "User",
    entidadeId: bloqueio.userId,
    detalhe: `${bloqueio.user.nome}${parsed.data.motivoRemocao ? `: ${parsed.data.motivoRemocao}` : ""}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  return voltarComSucesso(
    CAMINHO,
    `${bloqueio.user.nome} desbloqueado. O histórico do bloqueio anterior fica registrado.`,
  );
}
