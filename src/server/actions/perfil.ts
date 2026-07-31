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
import { chavePixSchema, perfilTrabalhadorSchema, perfilEmpresaSchema } from "@/lib/validations";
import { primeiroErroZod } from "@/lib/actions";
import { cifrar, criptoConfigurada } from "@/lib/cripto";
import { normalizarChavePix } from "@/lib/pix";
import { type ActionState, zodToFieldErrors } from "@/lib/actions";
import { voltarComErro, voltarComSucesso, voltarParaOrigem } from "@/server/actions/navegacao";

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
  return voltarComSucesso("/trabalhador/perfil", "Perfil atualizado.");
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
  return voltarComSucesso("/empresa/perfil", "Perfil atualizado.");
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
  await voltarComSucesso("/trabalhador/notificacoes", "Notificação marcada como lida.");
}

export async function marcarTodasLidas() {
  const s = await requireTrabalhador();
  await prisma.notificacao.updateMany({ where: { userId: s.sub, lida: false }, data: { lida: true } });
  revalidatePath("/trabalhador/notificacoes");
  await voltarComSucesso("/trabalhador/notificacoes", "Todas as notificações foram marcadas como lidas.");
}

// --------------------------------------------------------------------------
// v4 — Chave PIX do trabalhador (item 2)
// --------------------------------------------------------------------------
/**
 * Cadastra/atualiza a chave PIX, gravando **cifrada** (ADR 0005).
 *
 * A validação por tipo fica em `lib/pix.ts` (pura, testada): a chave é normalizada
 * antes de cifrar, para a empresa copiar exatamente o que o banco aceita.
 */
export async function salvarChavePix(formData: FormData): Promise<void> {
  const s = await requireTrabalhador();

  const parsed = chavePixSchema.safeParse({ tipo: formData.get("tipo"), chave: formData.get("chave") });
  if (!parsed.success) {
    return voltarComErro("/trabalhador/perfil", primeiroErroZod(parsed.error));
  }

  if (!criptoConfigurada()) {
    return voltarComErro(
      "/trabalhador/perfil",
      "O servidor está sem a chave de cifragem (PIX_ENCRYPTION_KEY). Sua chave PIX não foi salva — avise o suporte.",
    );
  }

  const normalizada = normalizarChavePix(parsed.data.tipo, parsed.data.chave);
  if (!normalizada.ok) {
    return voltarComErro("/trabalhador/perfil", normalizada.erro ?? "Chave PIX inválida.");
  }

  await prisma.user.update({
    where: { id: s.sub },
    data: {
      pixTipo: parsed.data.tipo,
      pixChaveCifrada: cifrar(normalizada.valor!),
      pixAtualizadoEm: new Date(),
    },
  });

  // Auditoria registra a ALTERAÇÃO (sem o valor, que é o dado sensível).
  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "PIX_CADASTRADO",
    entidade: "User",
    entidadeId: s.sub,
    detalhe: `tipo ${parsed.data.tipo}`,
  });

  return voltarComSucesso("/trabalhador/perfil", "Chave PIX salva com segurança (guardada cifrada).");
}

/** Remove a chave PIX cadastrada (direito de não manter o dado). */
export async function removerChavePix(): Promise<void> {
  const s = await requireTrabalhador();
  await prisma.user.update({
    where: { id: s.sub },
    data: { pixTipo: null, pixChaveCifrada: null, pixAtualizadoEm: null },
  });
  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "PIX_REMOVIDO",
    entidade: "User",
    entidadeId: s.sub,
  });
  revalidatePath("/trabalhador/perfil");
  await voltarComSucesso("/trabalhador/perfil", "Chave PIX removida.");
}
