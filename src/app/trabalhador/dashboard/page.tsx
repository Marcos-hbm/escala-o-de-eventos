import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reputacoesDeTrabalhadores, presencasDeTrabalhadores } from "@/lib/reputacao";
import { Card, Badge } from "@/components/ui/card";
import { StatTile, Bar, Estrelas } from "@/components/ui/stat";
import { porcentagem } from "@/lib/stats";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { CalendarCheck, Wallet, Link2, Star } from "lucide-react";

export const metadata = { title: "Painel — Escala" };

export default async function DashboardTrabalhador() {
  const s = await requireTrabalhador();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [porStatus, ganhosAgg, vinculosAtivos, naoLidas, rep, pres, proximos] = await Promise.all([
    prisma.inscricao.groupBy({ by: ["status"], where: { userId: s.sub }, _count: { _all: true } }),
    prisma.inscricao.findMany({
      where: { userId: s.sub, status: { in: ["ESCALADO", "PRESENTE"] } },
      include: { evento: { select: { valorCache: true } } },
    }),
    prisma.vinculo.count({ where: { userId: s.sub, status: "ATIVO" } }),
    prisma.notificacao.count({ where: { userId: s.sub, lida: false } }),
    reputacoesDeTrabalhadores([s.sub]),
    presencasDeTrabalhadores([s.sub]),
    prisma.inscricao.findMany({
      where: { userId: s.sub, status: "ESCALADO", evento: { dataEvento: { gte: hoje } } },
      include: { evento: { include: { empresa: { select: { nome: true } } } } },
      orderBy: { evento: { dataEvento: "asc" } },
      take: 5,
    }),
  ]);

  const cont = (st: string) => porStatus.find((g) => g.status === st)?._count._all ?? 0;
  const ganhos = ganhosAgg.reduce((a, i) => a + Number(i.evento.valorCache), 0);
  const minhaRep = rep.get(s.sub) ?? { media: null, qtd: 0 };
  const minhaPres = pres.get(s.sub) ?? { presentes: 0, faltas: 0 };
  const totalPres = minhaPres.presentes + minhaPres.faltas;
  const taxaPres = porcentagem(minhaPres.presentes, totalPres);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="text-sm text-muted">Olá, {s.nome}. Seu desempenho e próximos trabalhos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ganhos (escalado)" value={formatBRL(ganhos)} hint="eventos escalados + realizados" icon={<Wallet className="h-5 w-5" />} />
        <StatTile label="Escalações" value={cont("ESCALADO") + cont("PRESENTE")} hint={`${cont("INSCRITO")} inscrições abertas`} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatTile label="Reputação" value={minhaRep.media != null ? minhaRep.media.toFixed(1) : "—"} hint={<Estrelas media={minhaRep.media} qtd={minhaRep.qtd} />} icon={<Star className="h-5 w-5" />} />
        <StatTile label="Vínculos" value={vinculosAtivos} hint={naoLidas > 0 ? `${naoLidas} notificação(ões) nova(s)` : "empresas conectadas"} icon={<Link2 className="h-5 w-5" />} />
      </div>

      {totalPres > 0 && (
        <Card>
          <h2 className="mb-4 font-semibold">Taxa de presença</h2>
          <Bar label="Presenças confirmadas" pct={taxaPres} right={`${minhaPres.presentes}/${totalPres}`} />
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Próximos trabalhos</h2>
          <Link href="/trabalhador/historico" className="text-sm text-brand-600 hover:underline">Histórico →</Link>
        </div>
        {proximos.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma escala futura. Veja <Link href="/trabalhador/eventos" className="text-brand-600 hover:underline">oportunidades</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {proximos.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-surface p-3">
                <div>
                  <p className="font-medium">{i.evento.nome}</p>
                  <p className="text-xs text-muted">{i.evento.empresa.nome} · {formatarDataCivil(i.evento.dataEvento)} · {formatBRL(Number(i.evento.valorCache))}</p>
                </div>
                <Badge tone="success">Escalado</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
