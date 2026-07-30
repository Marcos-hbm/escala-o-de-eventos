"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashSenha, verificarCredenciais } from "@/lib/auth";
import { createSession, destroySession, getSession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/audit";
import {
  cadastroTrabalhadorSchema,
  cadastroEmpresaSchema,
  loginSchema,
} from "@/lib/validations";
import { type ActionState, zodToFieldErrors } from "@/lib/actions";

const APP_VERSION_PRIVACIDADE = "1.0";

/** Dias de teste gratuito concedidos a uma empresa recém-cadastrada (v3 SaaS). */
const TRIAL_DIAS = 14;

function emDias(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

// --------------------------------------------------------------------------
// RF01 — Cadastro de trabalhador
// --------------------------------------------------------------------------
export async function cadastrarTrabalhador(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cadastroTrabalhadorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    dataNascimento: formData.get("dataNascimento"),
    telefone: formData.get("telefone"),
    genero: formData.get("genero") || "NAO_INFORMADO",
    senha: formData.get("senha"),
    aceiteLgpd: formData.get("aceiteLgpd") === "on" || formData.get("aceiteLgpd") === "true",
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const d = parsed.data;

  const [emailExiste, cpfExiste] = await Promise.all([
    prisma.user.findUnique({ where: { email: d.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { cpf: d.cpf }, select: { id: true } }),
  ]);
  if (emailExiste) return { ok: false, fieldErrors: { email: ["E-mail já cadastrado"] } };
  if (cpfExiste) return { ok: false, fieldErrors: { cpf: ["CPF já cadastrado"] } };

  const user = await prisma.user.create({
    data: {
      nome: d.nome,
      email: d.email,
      cpf: d.cpf,
      dataNascimento: d.dataNascimento,
      telefone: d.telefone,
      genero: d.genero,
      senhaHash: await hashSenha(d.senha),
      consentimentos: {
        create: { finalidade: "termos_e_privacidade", versao: APP_VERSION_PRIVACIDADE },
      },
    },
  });

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: user.id,
    acao: "CADASTRO",
    entidade: "User",
    entidadeId: user.id,
  });

  await createSession({ sub: user.id, tipo: "TRABALHADOR", nome: user.nome, email: user.email });
  redirect("/trabalhador/eventos");
}

// --------------------------------------------------------------------------
// RF02 — Cadastro de empresa
// --------------------------------------------------------------------------
export async function cadastrarEmpresa(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cadastroEmpresaSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    senha: formData.get("senha"),
    aceiteLgpd: formData.get("aceiteLgpd") === "on" || formData.get("aceiteLgpd") === "true",
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const d = parsed.data;

  const [emailExiste, cnpjExiste] = await Promise.all([
    prisma.empresa.findUnique({ where: { email: d.email }, select: { id: true } }),
    prisma.empresa.findUnique({ where: { cnpj: d.cnpj }, select: { id: true } }),
  ]);
  if (emailExiste) return { ok: false, fieldErrors: { email: ["E-mail já cadastrado"] } };
  if (cnpjExiste) return { ok: false, fieldErrors: { cnpj: ["CNPJ já cadastrado"] } };

  // O mesmo e-mail não pode existir como membro de outra conta (o login de
  // empresa resolve por `membros`, cujo e-mail é único).
  const membroExiste = await prisma.membro.findUnique({ where: { email: d.email }, select: { id: true } });
  if (membroExiste) return { ok: false, fieldErrors: { email: ["E-mail já cadastrado"] } };

  const senhaHash = await hashSenha(d.senha);

  // v3 (SaaS): a conta nasce com o membro PROPRIETARIO (quem se cadastrou) e uma
  // assinatura STARTER em TRIAL — numa transação, para não existir empresa sem
  // dono nem sem plano.
  const empresa = await prisma.empresa.create({
    data: {
      nome: d.nome,
      cnpj: d.cnpj,
      email: d.email,
      telefone: d.telefone,
      senhaHash,
      membros: {
        create: { nome: d.nome, email: d.email, senhaHash, papel: "PROPRIETARIO" },
      },
      assinatura: {
        create: { plano: "STARTER", status: "TRIAL", trialTerminaEm: emDias(TRIAL_DIAS) },
      },
    },
    include: { membros: true },
  });
  const proprietario = empresa.membros[0];

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: empresa.id,
    acao: "CADASTRO",
    entidade: "Empresa",
    entidadeId: empresa.id,
    detalhe: `plano STARTER (trial de ${TRIAL_DIAS} dias)`,
  });

  await createSession({
    sub: empresa.id,
    tipo: "EMPRESA",
    nome: empresa.nome,
    email: proprietario.email,
    membroId: proprietario.id,
    papel: proprietario.papel,
    membroNome: proprietario.nome,
  });
  redirect("/empresa/eventos");
}

// --------------------------------------------------------------------------
// RF03 — Autenticação
// --------------------------------------------------------------------------
export async function entrar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    tipo: formData.get("tipo"),
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const { tipo, email, senha } = parsed.data;

  const sessao = await verificarCredenciais(tipo, email, senha);
  if (!sessao) {
    await registrarAuditoria({
      atorTipo: tipo,
      acao: "LOGIN_FALHA",
      detalhe: `email=${email}`,
    });
    return { ok: false, message: "E-mail ou senha incorretos." };
  }

  await createSession(sessao);
  await registrarAuditoria({
    atorTipo: tipo,
    atorId: sessao.sub,
    acao: "LOGIN",
    // Com multiusuário por empresa, o log precisa dizer QUAL membro entrou.
    detalhe: sessao.membroId != null ? `membro ${sessao.email} (${sessao.papel})` : undefined,
  });

  const next = String(formData.get("next") || "");
  const destino =
    next && next.startsWith("/") ? next : tipo === "EMPRESA" ? "/empresa/eventos" : "/trabalhador/eventos";
  redirect(destino);
}

// --------------------------------------------------------------------------
// Logout
// --------------------------------------------------------------------------
export async function sair(): Promise<void> {
  const s = await getSession();
  if (s) {
    await registrarAuditoria({ atorTipo: s.tipo, atorId: s.sub, acao: "LOGOUT" });
  }
  await destroySession();
  redirect("/login");
}
