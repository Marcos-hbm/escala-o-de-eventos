import Link from "next/link";
import { papelDaSessao, requireEmpresa } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reputacaoDeEmpresa } from "@/lib/reputacao";
import { Card, Badge } from "@/components/ui/card";
import { AvisoNegado } from "@/components/aviso-negado";
import { StatTile, Bar, Estrelas } from "@/components/ui/stat";
import { porcentagem } from "@/lib/stats";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { CalendarDays, Users, ListChecks, Star, Plus } from "lucide-react";

export const metadata = { title: "Painel — Escala" };

export default async function DashboardEmpresa({
  searchParams,
}: {
  searchParams: Promise<{ negado?: string }>;
}) {
  const s = await requireEmpresa();
  // O RBAC redireciona para cá quando o papel não tem acesso a uma tela.
  const { negado } = await searchParams;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [porStatus, vinculosAtivos, eventos, escaladosAgg, reputacao, proximos] = await Promise.all([
    prisma.evento.groupBy({ by: ["status"], where: { empresaId: s.sub }, _count: { _all: true } }),
    prisma.vinculo.count({ where: { empresaId: s.sub, status: "ATIVO" } }),
    prisma.evento.findMany({ where: { empresaId: s.sub, status: "FINALIZADO" }, select: { vagas: true } }),
    prisma.inscricao.count({
      where: { evento: { empresaId: s.sub, status: "FINALIZADO" }, status: { in: ["ESCALADO", "PRESENTE", "FALTA"] } },
    }),
    reputacaoDeEmpresa(s.sub),
    prisma.evento.findMany({
      where: { empresaId: s.sub, status: "PUBLICADO", dataEvento: { gte: hoje } },
      orderBy: { dataEvento: "asc" },
      take: 5,
      include: { _count: { select: { inscricoes: true } } },
    }),
  ]);

  const contagem = (st: string) => porStatus.find((g) => g.status === st)?._count._all ?? 0;
  const totalEventos = porStatus.reduce((a, g) => a + g._count._all, 0);
  const totalVagasFinalizadas = eventos.reduce((a, e) => a + e.vagas, 0);
  const taxaPreenchimento = porcentagem(escaladosAgg, totalVagasFinalizadas);

  return (
    <div className="space-y-6">
      <AvisoNegado negado={negado} papel={papelDaSessao(s)} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel</h1>
          <p className="text-sm text-muted">Olá, {s.nome}. Visão geral da sua operação.</p>
        </div>
        <Link href="/empresa/eventos/novo" className="hidden sm:block">
          <span className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Novo evento
          </span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Eventos" value={totalEventos} hint={`${contagem("PUBLICADO")} publicados · ${contagem("FINALIZADO")} finalizados`} icon={<CalendarDays className="h-5 w-5" />} />
        <StatTile label="Vínculos ativos" value={vinculosAtivos} hint="trabalhadores conectados" icon={<Users className="h-5 w-5" />} />
        <StatTile label="Preenchimento" value={`${taxaPreenchimento}%`} hint="vagas preenchidas em eventos finalizados" icon={<ListChecks className="h-5 w-5" />} />
        <StatTile label="Reputação" value={reputacao.media != null ? reputacao.media.toFixed(1) : "—"} hint={<Estrelas media={reputacao.media} qtd={reputacao.qtd} />} icon={<Star className="h-5 w-5" />} />
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Taxa de preenchimento de vagas</h2>
        <Bar label="Eventos finalizados" pct={taxaPreenchimento} right={`${escaladosAgg}/${totalVagasFinalizadas} vagas`} />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Próximos eventos</h2>
          <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">Ver todos →</Link>
        </div>
        {proximos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento publicado futuro.</p>
        ) : (
          <div className="space-y-2">
            {proximos.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-surface p-3">
                <div>
                  <p className="font-medium">{e.nome}</p>
                  <p className="text-xs text-muted">{formatarDataCivil(e.dataEvento)} · {e._count.inscricoes} inscrito(s) · {formatBRL(Number(e.valorCache))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{e.vagas} vaga(s)</Badge>
                  <Link href={`/empresa/eventos/${e.id}/escalar`} className="text-sm text-brand-600 hover:underline">Escalar</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
