import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { gerarCsvEscala, type LinhaEscala } from "@/lib/csv";
import { formatCPF } from "@/lib/utils";
import { registrarAuditoria } from "@/lib/audit";

/**
 * RF11 — Download da lista de escalados em CSV.
 * Apenas a empresa dona do evento pode baixar (autorização por recurso).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventoId = Number(id);

  const s = await getSession();
  if (!s || s.tipo !== "EMPRESA") {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    include: {
      inscricoes: {
        where: { status: { in: ["ESCALADO", "PRESENTE"] } },
        include: { user: true },
        orderBy: { user: { nome: "asc" } },
      },
    },
  });

  if (!evento || evento.empresaId !== s.sub) {
    return new NextResponse("Evento não encontrado", { status: 404 });
  }

  const linhas: LinhaEscala[] = evento.inscricoes.map((i) => ({
    nome: i.user.nome,
    cpf: formatCPF(i.user.cpf),
    telefone: i.user.telefone,
    email: i.user.email,
    funcao: evento.funcoes ?? "",
    status: i.status,
  }));

  // `valorCache` é Decimal do Prisma: converte aqui para o gerador de CSV
  // permanecer puro (sem conhecer tipos do banco).
  const csv = gerarCsvEscala(
    {
      nome: evento.nome,
      dataEvento: evento.dataEvento,
      local: evento.local,
      horaInicio: evento.horaInicio,
      valorCache: Number(evento.valorCache),
    },
    linhas,
  );

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "LISTA_EXPORTADA",
    entidade: "Evento",
    entidadeId: eventoId,
  });

  const nomeArquivo = `escala_${evento.nome.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}_${eventoId}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
