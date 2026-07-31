import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  INDICADOR_STATUS,
  ROTULOS_FORMA,
  resumirPagamentos,
  saldoRestante,
  type FormaPagamentoId,
  type StatusPagamentoId,
} from "@/lib/domain/pagamento";
import { formatarDataCivil, formatarDataHora } from "@/lib/datetime";
import { formatarBRL } from "@/lib/dinheiro";
import { lerParametrosPagina, montarPagina } from "@/lib/paginacao";
import { Card, Badge } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { Paginacao } from "@/components/ui/paginacao";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { ContestarPagamentoForm } from "./contestar-form";
import { Wallet, CircleAlert, Receipt } from "lucide-react";

export const metadata = { title: "Meus pagamentos — Escala" };

const TOM_STATUS: Record<StatusPagamentoId, "success" | "warning" | "neutral" | "danger"> = {
  PAGO: "success",
  PARCIAL: "warning",
  PENDENTE: "neutral",
  CANCELADO: "danger",
};

/**
 * v4 — Histórico financeiro do trabalhador (itens 6 e 10).
 *
 * Mostra, por evento: empresa, valor, o que já foi pago, forma, situação (✅/⏳),
 * histórico de lançamentos e o caminho para contestar.
 */
export default async function FinanceiroTrabalhador({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; tamanho?: string; aviso?: string; erro_op?: string }>;
}) {
  const s = await requireTrabalhador();
  const sp = await searchParams;
  const params = lerParametrosPagina({ pagina: sp.pagina, tamanho: sp.tamanho });

  const [itens, total, todos] = await Promise.all([
    prisma.pagamento.findMany({
      where: { userId: s.sub },
      include: {
        evento: { select: { id: true, nome: true, dataEvento: true } },
        empresa: { select: { nome: true } },
        lancamentos: { orderBy: { createdAt: "desc" } },
        contestacoes: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ evento: { dataEvento: "desc" } }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.pagamento.count({ where: { userId: s.sub } }),
    // Resumo é sobre TODOS os pagamentos, não só a página atual.
    prisma.pagamento.findMany({
      where: { userId: s.sub },
      select: { valorDevido: true, valorPago: true, status: true },
    }),
  ]);

  const pagina = montarPagina(itens, total, params);
  const resumo = resumirPagamentos(
    todos.map((p) => ({ valorDevido: Number(p.valorDevido), valorPago: Number(p.valorPago), status: p.status })),
  );

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho="/trabalhador/financeiro" />

      <div>
        <h1 className="text-2xl font-bold">Meus pagamentos</h1>
        <p className="text-sm text-muted">Valores combinados, recebidos e pendentes por evento.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total combinado" value={formatarBRL(resumo.total)} hint={`${resumo.quantidade} evento(s)`} icon={<Receipt className="h-5 w-5" />} />
        <StatTile label="Recebido" value={formatarBRL(resumo.pago)} hint={`${resumo.quantidadePagos} quitado(s)`} icon={<Wallet className="h-5 w-5" />} />
        <StatTile label="A receber" value={formatarBRL(resumo.pendente)} hint={`${resumo.quantidadePendentes} em aberto`} icon={<CircleAlert className="h-5 w-5" />} />
      </div>

      {itens.length === 0 ? (
        <EmptyState
          icone={<Wallet className="h-6 w-6" />}
          titulo="Nenhum pagamento registrado ainda"
          descricao="Depois de ser escalado em um evento, o valor combinado e a situação do pagamento aparecem aqui."
          acao={{ href: "/trabalhador/eventos", rotulo: "Ver vagas abertas" }}
        />
      ) : (
        <div className="space-y-3">
          {itens.map((p) => {
            const devido = Number(p.valorDevido);
            const pago = Number(p.valorPago);
            const restante = saldoRestante(devido, pago);
            const contestacaoAberta = p.contestacoes.find((c) => c.status === "ABERTA" || c.status === "EM_ANALISE");

            return (
              <Card key={p.id} data-testid="pagamento-trabalhador" className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.evento.nome}</p>
                    <p className="text-xs text-muted">
                      {p.empresa.nome} · {formatarDataCivil(p.evento.dataEvento)}
                      {p.funcao ? ` · ${p.funcao}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={TOM_STATUS[p.status]} data-testid="indicador-pagamento">
                      {INDICADOR_STATUS[p.status]}
                    </Badge>
                    <p className="mt-1 text-sm">
                      <strong>{formatarBRL(pago)}</strong> de {formatarBRL(devido)}
                    </p>
                    {restante > 0 && <p className="text-xs text-muted">Falta receber {formatarBRL(restante)}</p>}
                    {p.forma && <p className="text-xs text-muted">Forma: {ROTULOS_FORMA[p.forma as FormaPagamentoId]}</p>}
                  </div>
                </div>

                {p.lancamentos.length > 0 && (
                  <details className="rounded-lg border border-surface p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Histórico ({p.lancamentos.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.lancamentos.map((l) => (
                        <li key={l.id} className="flex flex-wrap justify-between gap-2">
                          <span>
                            {formatarBRL(Number(l.valor))} · {ROTULOS_FORMA[l.forma as FormaPagamentoId]}
                            {l.observacao ? ` · ${l.observacao}` : ""}
                          </span>
                          <span className="text-muted">{formatarDataHora(l.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {p.contestacoes.map((c) => (
                  <div
                    key={c.id}
                    data-testid="minha-contestacao"
                    className="rounded-lg border border-surface bg-slate-50 p-3 text-sm dark:bg-slate-800/50"
                  >
                    <p className="font-medium">
                      Contestação #{c.id} · {c.motivo}{" "}
                      <Badge tone={c.status === "RESOLVIDA" ? "success" : c.status === "REJEITADA" ? "neutral" : "warning"}>
                        {c.status}
                      </Badge>
                    </p>
                    <p className="mt-1 text-muted">{c.descricao}</p>
                    {c.resposta && (
                      <p className="mt-2 rounded bg-surface p-2">
                        <strong>Resposta da empresa:</strong> {c.resposta}
                      </p>
                    )}
                  </div>
                ))}

                {!contestacaoAberta && (
                  <ContestarPagamentoForm pagamentoId={p.id} evento={p.evento.nome} />
                )}
              </Card>
            );
          })}

          <Paginacao pagina={pagina} base="/trabalhador/financeiro" filtros={{}} singular="pagamento" />
        </div>
      )}

      <Card className="text-xs text-muted">
        Cadastre sua chave PIX no{" "}
        <Link href="/trabalhador/perfil" className="text-brand-600 hover:underline">Perfil</Link>{" "}
        para receber por PIX. Ela é guardada cifrada e só fica visível para empresas em que você foi escalado.
      </Card>
    </div>
  );
}
