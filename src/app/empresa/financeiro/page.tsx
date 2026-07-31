import Link from "next/link";
import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  INDICADOR_STATUS,
  ROTULOS_FORMA,
  resumirPagamentos,
  type FormaPagamentoId,
  type StatusPagamentoId,
} from "@/lib/domain/pagamento";
import { formatarDataCivil, formatarDataHora } from "@/lib/datetime";
import { formatarBRL } from "@/lib/dinheiro";
import { lerParametrosPagina, montarPagina } from "@/lib/paginacao";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { StatTile } from "@/components/ui/stat";
import { Paginacao } from "@/components/ui/paginacao";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { AvisoNegado } from "@/components/aviso-negado";
import { Wallet, CircleAlert, Receipt, Search, Filter } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Financeiro — Escala" };

const TOM_STATUS: Record<StatusPagamentoId, "success" | "warning" | "neutral" | "danger"> = {
  PAGO: "success",
  PARCIAL: "warning",
  PENDENTE: "neutral",
  CANCELADO: "danger",
};

/**
 * v4 — Histórico financeiro da empresa (item 10).
 *
 * Uma linha por pagamento (evento × trabalhador), com busca por nome/evento e
 * filtro por situação. Restrito a quem tem permissão financeira.
 */
export default async function FinanceiroEmpresa({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    pagina?: string;
    tamanho?: string;
    aviso?: string;
    erro_op?: string;
  }>;
}) {
  const s = await requireEmpresa();
  const sp = await searchParams;

  if (!sessaoPode(s, "financeiro:ver")) {
    return (
      <div className="space-y-6">
        <AvisoNegado negado="financeiro:ver" papel={papelDaSessao(s)} />
        <EmptyState
          icone={<Wallet className="h-6 w-6" />}
          titulo="Área financeira restrita"
          descricao="Somente Proprietário, Administrador ou Coordenador com acesso financeiro pode ver o histórico financeiro."
          acao={{ href: "/empresa/dashboard", rotulo: "Voltar ao painel" }}
        />
      </div>
    );
  }

  const params = lerParametrosPagina({ pagina: sp.pagina, tamanho: sp.tamanho });
  const statusFiltro = ["PENDENTE", "PARCIAL", "PAGO", "CANCELADO"].includes(sp.status ?? "")
    ? (sp.status as StatusPagamentoId)
    : undefined;

  const where: Prisma.PagamentoWhereInput = { empresaId: s.sub };
  if (statusFiltro) where.status = statusFiltro;
  if (sp.q) {
    where.OR = [
      { user: { nome: { contains: sp.q, mode: "insensitive" } } },
      { evento: { nome: { contains: sp.q, mode: "insensitive" } } },
    ];
  }

  const [itens, total, todos, contestacoesAbertas] = await Promise.all([
    prisma.pagamento.findMany({
      where,
      include: {
        user: { select: { id: true, nome: true } },
        evento: { select: { id: true, nome: true, dataEvento: true } },
        registradoPor: { select: { nome: true } },
        _count: { select: { lancamentos: true } },
      },
      orderBy: [{ evento: { dataEvento: "desc" } }, { user: { nome: "asc" } }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.pagamento.count({ where }),
    prisma.pagamento.findMany({
      where: { empresaId: s.sub },
      select: { valorDevido: true, valorPago: true, status: true },
    }),
    prisma.contestacaoPagamento.count({
      where: { pagamento: { empresaId: s.sub }, status: { in: ["ABERTA", "EM_ANALISE"] } },
    }),
  ]);

  const pagina = montarPagina(itens, total, params);
  const resumo = resumirPagamentos(
    todos.map((p) => ({ valorDevido: Number(p.valorDevido), valorPago: Number(p.valorPago), status: p.status })),
  );

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho="/empresa/financeiro" />

      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted">Histórico de pagamentos por evento e trabalhador.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total devido" value={formatarBRL(resumo.total)} hint={`${resumo.quantidade} pagamento(s)`} icon={<Receipt className="h-5 w-5" />} />
        <StatTile label="Pago" value={formatarBRL(resumo.pago)} hint={`${resumo.quantidadePagos} quitado(s)`} icon={<Wallet className="h-5 w-5" />} />
        <StatTile label="Pendente" value={formatarBRL(resumo.pendente)} hint={`${resumo.quantidadePendentes} em aberto`} icon={<CircleAlert className="h-5 w-5" />} />
        <StatTile
          label="Contestações"
          value={contestacoesAbertas}
          hint={contestacoesAbertas > 0 ? "aguardando resposta" : "nenhuma em aberto"}
        />
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted" htmlFor="q">Trabalhador ou evento</label>
            <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nome" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor="status">Situação</label>
            <Select id="status" name="status" defaultValue={sp.status ?? ""} className="w-44">
              <option value="">Todas</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PARCIAL">Parcial</option>
              <option value="PAGO">Pago</option>
              <option value="CANCELADO">Cancelado</option>
            </Select>
          </div>
          <Button type="submit"><Search className="h-4 w-4" /> Filtrar</Button>
        </form>
      </Card>

      {itens.length === 0 ? (
        <EmptyState
          icone={<Filter className="h-6 w-6" />}
          titulo={sp.q || statusFiltro ? "Nenhum pagamento com esses filtros" : "Nenhum pagamento registrado ainda"}
          descricao={
            sp.q || statusFiltro
              ? "Ajuste a busca ou a situação para ver outros pagamentos."
              : "Depois de escalar trabalhadores, abra “Finalizar pagamentos” no evento para registrar os valores."
          }
          acao={sp.q || statusFiltro ? { href: "/empresa/financeiro", rotulo: "Limpar filtros" } : { href: "/empresa/eventos", rotulo: "Ver eventos" }}
        />
      ) : (
        <div className="space-y-2">
          {itens.map((p) => (
            <Card key={p.id} data-testid="linha-financeiro" className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{p.user.nome}</p>
                <p className="text-xs text-muted">
                  {p.evento.nome} · {formatarDataCivil(p.evento.dataEvento)}
                  {p.funcao ? ` · ${p.funcao}` : ""}
                  {p._count.lancamentos > 0 ? ` · ${p._count.lancamentos} lançamento(s)` : ""}
                </p>
                {p.quitadoEm && (
                  <p className="text-xs text-muted">
                    Quitado em {formatarDataHora(p.quitadoEm)}
                    {p.registradoPor ? ` por ${p.registradoPor.nome}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={TOM_STATUS[p.status]}>{INDICADOR_STATUS[p.status]}</Badge>
                <p className="text-sm">
                  <strong>{formatarBRL(Number(p.valorPago))}</strong> de {formatarBRL(Number(p.valorDevido))}
                </p>
                {p.forma && <p className="text-xs text-muted">{ROTULOS_FORMA[p.forma as FormaPagamentoId]}</p>}
                <Link
                  href={`/empresa/eventos/${p.evento.id}/pagamentos`}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Abrir pagamentos do evento →
                </Link>
              </div>
            </Card>
          ))}

          <Paginacao
            pagina={pagina}
            base="/empresa/financeiro"
            filtros={{ q: sp.q, status: sp.status }}
            singular="pagamento"
          />
        </div>
      )}
    </div>
  );
}
