import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { assinaturaDaEmpresa, usoDaEmpresa } from "@/lib/assinatura";
import {
  ORDEM_PLANOS,
  PLANOS,
  limitesDoPlano,
  pctUso,
  rotuloLimite,
  rotuloPlano,
  type RecursoContavel,
} from "@/lib/planos";
import { Card, Badge } from "@/components/ui/card";
import { Bar, StatTile } from "@/components/ui/stat";
import { AvisoNegado } from "@/components/aviso-negado";
import { TrocarPlanoForm } from "./plano-form";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { CreditCard, CalendarClock, Check, Minus } from "lucide-react";

export const metadata = { title: "Plano — Escala" };

const LINHAS_USO: { recurso: RecursoContavel; label: string }[] = [
  { recurso: "maxMembros", label: "Usuários da conta" },
  { recurso: "maxEventosAtivos", label: "Eventos ativos" },
  { recurso: "maxVinculosAtivos", label: "Vínculos ativos/pendentes" },
];

const TOM_STATUS = {
  TRIAL: "info",
  ATIVA: "success",
  INADIMPLENTE: "warning",
  CANCELADA: "danger",
} as const;

/**
 * v3 (SaaS) — Plano da conta: assinatura atual, consumo x limites e comparativo
 * de planos. Visível a qualquer membro; a troca exige `plano:gerenciar`.
 */
export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ negado?: string }>;
}) {
  const s = await requireEmpresa();
  const { negado } = await searchParams;
  const podeTrocar = sessaoPode(s, "plano:gerenciar");

  const [assinatura, uso] = await Promise.all([assinaturaDaEmpresa(s.sub), usoDaEmpresa(s.sub)]);
  const limites = limitesDoPlano(assinatura.plano);
  const def = PLANOS[assinatura.plano];

  return (
    <div className="space-y-6">
      <AvisoNegado negado={negado} papel={papelDaSessao(s)} />

      <div>
        <h1 className="text-2xl font-bold">Plano</h1>
        <p className="text-sm text-muted">Assinatura da conta, consumo dos limites e comparativo de planos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Plano atual"
          value={<span data-testid="plano-atual">{rotuloPlano(assinatura.plano)}</span>}
          hint={def.precoMensal === null ? "sob consulta" : `${formatBRL(def.precoMensal)}/mês`}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatTile
          label="Situação"
          value={<Badge tone={TOM_STATUS[assinatura.status]}>{assinatura.status}</Badge>}
          hint={assinatura.status === "TRIAL" ? "período de teste" : "assinatura"}
        />
        <StatTile
          label="Trial termina em"
          value={assinatura.trialTerminaEm ? formatarDataCivil(assinatura.trialTerminaEm) : "—"}
          hint={assinatura.trialTerminaEm ? "após essa data, escolha um plano" : "sem trial em andamento"}
          icon={<CalendarClock className="h-5 w-5" />}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Uso x limites do plano</h2>
        <div className="space-y-4">
          {LINHAS_USO.map(({ recurso, label }) => (
            <Bar
              key={recurso}
              label={label}
              pct={pctUso(uso[recurso], limites[recurso])}
              right={`${uso[recurso]} de ${rotuloLimite(limites[recurso])}`}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Ao atingir um limite, a ação correspondente é bloqueada com a orientação de como liberar espaço.
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">Planos</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {ORDEM_PLANOS.map((id) => {
            const p = PLANOS[id];
            const atual = id === assinatura.plano;
            return (
              <Card key={id} className={atual ? "border-brand-500 ring-1 ring-brand-500/40" : undefined}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.rotulo}</h3>
                  {atual && <Badge tone="info">Atual</Badge>}
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {p.precoMensal === null ? "Sob consulta" : p.precoMensal === 0 ? "Grátis" : formatBRL(p.precoMensal)}
                  {p.precoMensal ? <span className="text-sm font-normal text-muted">/mês</span> : null}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {p.destaques.map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span>{d}</span>
                    </li>
                  ))}
                  {!p.recursos.escalacaoInteligente && (
                    <li className="flex items-start gap-2 text-muted">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Sem escalação inteligente</span>
                    </li>
                  )}
                </ul>
                {podeTrocar ? (
                  <TrocarPlanoForm destino={id} atual={assinatura.plano} />
                ) : (
                  atual && <p className="mt-4 text-xs text-muted">Plano em uso.</p>
                )}
              </Card>
            );
          })}
        </div>
        {!podeTrocar && (
          <p className="text-sm text-muted">
            Somente o Proprietário da conta altera o plano.
          </p>
        )}
      </section>
    </div>
  );
}
