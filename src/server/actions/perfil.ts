"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, papelDaSessao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { getSession, destroySession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/audit";
import { salvarFotoPerfil } from "@/lib/upload";
import { anonimizarTrabalhador, anonimizarEmpresa } from "@/lib/lgpd";
import { pode } from "@/lib/rbac";
import { perfilTrabalhadorSchema, perfilEmpresaSchema } from "@/lib/validations";
import { type ActionState, zodToFieldErrors } from "@/lib/actions";
import { voltarParaOrigem } from "@/server/actions/navegacao";

// --------------------------------------------------------------------------
// RF04 — Editar perfil do trabalhador (inclui foto)
// --------------------------------------------------------------------------
export async function editarPerfilTrabalhador(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireTrabalhador();
  const parsed = perfilTrabalhadorSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
    genero: formData.get("genero"),
    cidade: formData.get("cidade"),
    bio: formData.get("bio"),
    habilidades: formData.get("habilidades"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }

  let fotoPath: string | undefined;
  try {
    fotoPath = (await salvarFotoPerfil(formData.get("foto") as File | null, `user${s.sub}`)) ?? undefined;
  } catch (e) {
    return { ok: false, fieldErrors: { foto: [(e as Error).message] } };
  }

  await prisma.user.update({
    where: { id: s.sub },
    data: {
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      genero: parsed.data.genero,
      cidade: parsed.data.cidade || null,
      bio: parsed.data.bio || null,
      habilidades: parsed.data.habilidades || null,
      ...(fotoPath ? { fotoPath } : {}),
    },
  });

  await registrarAuditoria({ atorTipo: "TRABALHADOR", atorId: s.sub, acao: "PERFIL_EDITADO" });
  revalidatePath("/trabalhador/perfil");
  return { ok: true, message: "Perfil atualizado." };
}

// --------------------------------------------------------------------------
// RF04 — Editar perfil da empresa (inclui logo)
// --------------------------------------------------------------------------
export async function editarPerfilEmpresa(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "empresa:editar");
  if (negado) return { ok: false, message: negado };

  const parsed = perfilEmpresaSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }

  let fotoPath: string | undefined;
  try {
    fotoPath = (await salvarFotoPerfil(formData.get("foto") as File | null, `empresa${s.sub}`)) ?? undefined;
  } catch (e) {
    return { ok: false, fieldErrors: { foto: [(e as Error).message] } };
  }

  await prisma.empresa.update({
    where: { id: s.sub },
    data: {
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      ...(fotoPath ? { fotoPath } : {}),
    },
  });

  await registrarAuditoria({ atorTipo: "EMPRESA", atorId: s.sub, acao: "PERFIL_EDITADO" });
  revalidatePath("/empresa/perfil");
  return { ok: true, message: "Perfil atualizado." };
}

// --------------------------------------------------------------------------
// LGPD — Excluir conta (anonimização; direito ao esquecimento)
// --------------------------------------------------------------------------
export async function excluirConta(): Promise<void> {
  const s = await getSession();
  if (!s) redirect("/login");

  if (s.tipo === "TRABALHADOR") {
    await anonimizarTrabalhador(s.sub);
  } else {
    // v3: excluir a conta da empresa afeta toda a equipe — só o Proprietário.
    if (!pode(papelDaSessao(s), "conta:excluir")) redirect("/empresa/perfil?negado=conta:excluir");
    await anonimizarEmpresa(s.sub);
  }

  await destroySession();
  redirect("/?conta=excluida");
}

// --------------------------------------------------------------------------
// LGPD — Exportar meus dados (download) é servido via route handler.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Notificações — marcar como lida
// --------------------------------------------------------------------------
export async function marcarNotificacaoLida(formData: FormData) {
  const s = await requireTrabalhador();
  const id = Number(formData.get("id"));
  await prisma.notificacao.updateMany({ where: { id, userId: s.sub }, data: { lida: true } });
  revalidatePath("/trabalhador/notificacoes");
  await voltarParaOrigem("/trabalhador/notificacoes");
}

export async function marcarTodasLidas() {
  const s = await requireTrabalhador();
  await prisma.notificacao.updateMany({ where: { userId: s.sub, lida: false }, data: { lida: true } });
  revalidatePath("/trabalhador/notificacoes");
  await voltarParaOrigem("/trabalhador/notificacoes");
}
