import "server-only";
import { prisma } from "./prisma";
import { registrarAuditoria } from "./audit";

/**
 * Rotinas de conformidade LGPD (Lei 13.709/2018).
 *
 * - Portabilidade / acesso (Art. 18, II e V): exportação dos dados pessoais.
 * - Eliminação / direito ao esquecimento (Art. 18, VI): anonimização.
 *
 * Optamos por ANONIMIZAR em vez de apagar fisicamente para preservar a
 * integridade de registros históricos (eventos já realizados, trilha de
 * auditoria), conforme permitido pelo Art. 16 quando há necessidade de
 * conservação para cumprimento de obrigação legal/exercício de direitos.
 */

export async function exportarDadosTrabalhador(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vinculos: { include: { empresa: { select: { nome: true, cnpj: true } } } },
      inscricoes: { include: { evento: { select: { nome: true, dataEvento: true } } } },
      notificacoes: true,
      consentimentos: true,
    },
  });
  if (!user) return null;

  // Remove o hash de senha do pacote exportado.
  const { senhaHash: _omit, ...dados } = user;
  return {
    geradoEm: new Date().toISOString(),
    titular: { tipo: "TRABALHADOR", id: userId },
    dadosPessoais: dados,
  };
}

export async function exportarDadosEmpresa(empresaId: number) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      eventos: { select: { id: true, nome: true, dataEvento: true, status: true } },
      vinculos: { include: { user: { select: { nome: true } } } },
    },
  });
  if (!empresa) return null;
  const { senhaHash: _omit, ...dados } = empresa;
  return {
    geradoEm: new Date().toISOString(),
    titular: { tipo: "EMPRESA", id: empresaId },
    dadosPessoais: dados,
  };
}

/**
 * Anonimiza um trabalhador: substitui dados identificáveis por marcadores,
 * invalida credenciais e marca a conta como inativa. Vínculos são desfeitos e
 * inscrições futuras canceladas. Registros históricos ficam preservados, porém
 * sem PII.
 */
export async function anonimizarTrabalhador(userId: number): Promise<void> {
  const marcador = `anon_${userId}`;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        nome: "Usuário removido",
        email: `${marcador}@anon.invalid`,
        cpf: marcador.padEnd(11, "0").slice(0, 11),
        telefone: "00000000000",
        fotoPath: null,
        senhaHash: "!", // hash inválido → não autentica
        genero: "NAO_INFORMADO",
        ativo: false,
        anonimizadoEm: new Date(),
      },
    });
    await tx.vinculo.updateMany({
      where: { userId },
      data: { status: "DESVINCULADO", favorito: false },
    });
    await tx.inscricao.updateMany({
      where: { userId, status: { in: ["INSCRITO", "ESCALADO"] }, evento: { dataEvento: { gte: new Date() } } },
      data: { status: "CANCELADO_TRABALHADOR" },
    });
    await tx.notificacao.deleteMany({ where: { userId } });
  });

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: userId,
    acao: "LGPD_ANONIMIZACAO",
    entidade: "User",
    entidadeId: userId,
    detalhe: "Direito ao esquecimento (LGPD Art. 18, VI)",
  });
}

/** Anonimiza uma empresa: dados identificáveis removidos, conta inativada. */
export async function anonimizarEmpresa(empresaId: number): Promise<void> {
  const marcador = `anon_${empresaId}`;
  await prisma.$transaction(async (tx) => {
    await tx.empresa.update({
      where: { id: empresaId },
      data: {
        nome: "Empresa removida",
        email: `${marcador}@anon.invalid`,
        cnpj: marcador.padEnd(14, "0").slice(0, 14),
        telefone: "00000000000",
        fotoPath: null,
        senhaHash: "!",
        ativo: false,
        anonimizadoEm: new Date(),
      },
    });
    await tx.vinculo.updateMany({ where: { empresaId }, data: { status: "DESVINCULADO" } });
    await tx.evento.updateMany({
      where: { empresaId, status: { in: ["PUBLICADO", "RASCUNHO"] } },
      data: { status: "CANCELADO" },
    });
    // v3 (SaaS): o login de empresa resolve por `membros`, então TODA a equipe
    // perde credencial e acesso — senão um membro continuaria entrando numa
    // conta "excluída".
    const membros = await tx.membro.findMany({ where: { empresaId }, select: { id: true } });
    for (const m of membros) {
      await tx.membro.update({
        where: { id: m.id },
        data: {
          nome: "Membro removido",
          email: `${marcador}_m${m.id}@anon.invalid`,
          senhaHash: "!", // hash inválido → não autentica
          ativo: false,
        },
      });
    }
    // A assinatura é cancelada (mantida como histórico contratual, sem PII).
    await tx.assinatura.updateMany({ where: { empresaId }, data: { status: "CANCELADA" } });
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: empresaId,
    acao: "LGPD_ANONIMIZACAO",
    entidade: "Empresa",
    entidadeId: empresaId,
    detalhe: "Direito ao esquecimento (LGPD Art. 18, VI)",
  });
}
