"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, hashSenha, papelDaSessao, requireEmpresa } from "@/lib/auth";
import { erroDeLimite } from "@/lib/assinatura";
import { papeisAtribuiveis, rotuloPapel, type PapelId } from "@/lib/rbac";
import { registrarAuditoria } from "@/lib/audit";
import { alterarPapelSchema, membroSchema } from "@/lib/validations";
import { type ActionState, zodToFieldErrors } from "@/lib/actions";
import { voltarComSucesso } from "@/server/actions/navegacao";

/**
 * v3 (SaaS) — Equipe da empresa (multiusuário + RBAC).
 *
 * Toda ação aqui exige a permissão `equipe:gerenciar` (PROPRIETARIO/ADMIN) e
 * respeita o limite de membros do plano. Regras de proteção do dono:
 * - só o PROPRIETARIO atribui/retira o papel PROPRIETARIO;
 * - a empresa nunca fica sem PROPRIETARIO ativo;
 * - ninguém desativa a si mesmo (evita perder o acesso por acidente).
 */

/** Auditoria com o membro que agiu (o ator do log é o tenant). */
function detalheAtor(membroNome: string | undefined, extra: string): string {
  return membroNome ? `por ${membroNome}: ${extra}` : extra;
}

// --------------------------------------------------------------------------
// Convidar/criar membro
// --------------------------------------------------------------------------
export async function criarMembro(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "equipe:gerenciar");
  if (negado) return { ok: false, message: negado };

  const parsed = membroSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    papel: formData.get("papel"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const d = parsed.data;

  if (!papeisAtribuiveis(papelDaSessao(s)).includes(d.papel)) {
    return { ok: false, fieldErrors: { papel: [`Você não pode atribuir o papel ${rotuloPapel(d.papel)}.`] } };
  }

  const limite = await erroDeLimite(s.sub, "maxMembros");
  if (limite) return { ok: false, message: limite };

  const emailEmUso = await prisma.membro.findUnique({ where: { email: d.email }, select: { id: true } });
  if (emailEmUso) return { ok: false, fieldErrors: { email: ["E-mail já usado por outro membro"] } };

  const membro = await prisma.membro.create({
    data: {
      empresaId: s.sub,
      nome: d.nome,
      email: d.email,
      senhaHash: await hashSenha(d.senha),
      papel: d.papel,
    },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "MEMBRO_CRIADO",
    entidade: "Membro",
    entidadeId: membro.id,
    detalhe: detalheAtor(s.membroNome, `${d.email} como ${rotuloPapel(d.papel)}`),
  });

  revalidatePath("/empresa/equipe");
  return voltarComSucesso("/empresa/equipe", `${d.nome} agora tem acesso como ${rotuloPapel(d.papel)}.`);
}

// --------------------------------------------------------------------------
// Alterar papel de um membro
// --------------------------------------------------------------------------
export async function alterarPapel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "equipe:gerenciar");
  if (negado) return { ok: false, message: negado };

  const parsed = alterarPapelSchema.safeParse({
    membroId: formData.get("membroId"),
    papel: formData.get("papel"),
  });
  if (!parsed.success) return { ok: false, message: "Papel inválido." };
  const { membroId, papel } = parsed.data!;

  const membro = await prisma.membro.findUnique({ where: { id: membroId } });
  if (!membro || membro.empresaId !== s.sub) return { ok: false, message: "Membro não encontrado." };

  const meuPapel = papelDaSessao(s);
  const atribuiveis = papeisAtribuiveis(meuPapel);
  if (!atribuiveis.includes(papel)) {
    return { ok: false, message: `Você não pode atribuir o papel ${rotuloPapel(papel)}.` };
  }
  if (membro!.papel === "PROPRIETARIO" && meuPapel !== "PROPRIETARIO") {
    return { ok: false, message: "Somente o Proprietário pode alterar o papel do Proprietário." };
  }
  if (membro!.papel === "PROPRIETARIO" && papel !== "PROPRIETARIO") {
    const outrosDonos = await prisma.membro.count({
      where: { empresaId: s.sub, papel: "PROPRIETARIO", ativo: true, id: { not: membroId } },
    });
    if (outrosDonos === 0) {
      return {
        ok: false,
        message: "A empresa precisa de ao menos um Proprietário ativo. Promova outro membro antes.",
      };
    }
  }

  await prisma.membro.update({ where: { id: membroId }, data: { papel } });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "MEMBRO_PAPEL_ALTERADO",
    entidade: "Membro",
    entidadeId: membroId,
    detalhe: detalheAtor(s.membroNome, `${membro!.email}: ${rotuloPapel(membro!.papel as PapelId)} → ${rotuloPapel(papel)}`),
  });

  revalidatePath("/empresa/equipe");
  return voltarComSucesso("/empresa/equipe", `${membro!.nome} agora é ${rotuloPapel(papel)}.`);
}

// --------------------------------------------------------------------------
// Ativar / desativar acesso de um membro
// --------------------------------------------------------------------------
export async function alternarMembroAtivo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "equipe:gerenciar");
  if (negado) return { ok: false, message: negado };

  const membroId = Number(formData.get("membroId"));
  const membro = await prisma.membro.findUnique({ where: { id: membroId } });
  if (!membro || membro.empresaId !== s.sub) return { ok: false, message: "Membro não encontrado." };

  if (membro!.id === s.membroId) {
    return { ok: false, message: "Você não pode desativar o seu próprio acesso." };
  }
  if (membro!.papel === "PROPRIETARIO" && papelDaSessao(s) !== "PROPRIETARIO") {
    return { ok: false, message: "Somente o Proprietário pode desativar o Proprietário." };
  }

  const ativar = !membro!.ativo;
  if (ativar) {
    // Reativar consome cota de membros novamente.
    const limite = await erroDeLimite(s.sub, "maxMembros");
    if (limite) return { ok: false, message: limite };
  } else if (membro!.papel === "PROPRIETARIO") {
    const outrosDonos = await prisma.membro.count({
      where: { empresaId: s.sub, papel: "PROPRIETARIO", ativo: true, id: { not: membroId } },
    });
    if (outrosDonos === 0) {
      return { ok: false, message: "A empresa precisa de ao menos um Proprietário ativo." };
    }
  }

  await prisma.membro.update({ where: { id: membroId }, data: { ativo: ativar } });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: ativar ? "MEMBRO_REATIVADO" : "MEMBRO_DESATIVADO",
    entidade: "Membro",
    entidadeId: membroId,
    detalhe: detalheAtor(s.membroNome, membro!.email),
  });

  revalidatePath("/empresa/equipe");
  return voltarComSucesso(
    "/empresa/equipe",
    ativar ? `Acesso de ${membro!.nome} reativado.` : `Acesso de ${membro!.nome} revogado.`,
  );
}
