import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/server/actions/perfil";
import { formatarDataHora, formatarRelativo } from "@/lib/datetime";
import { lerParametrosPagina, montarPagina } from "@/lib/paginacao";
import { Paginacao } from "@/components/ui/paginacao";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";

export const metadata = { title: "Notificações — Escala" };

export default async function Notificacoes({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; tamanho?: string }>;
}) {
  const s = await requireTrabalhador();
  const { pagina, tamanho } = await searchParams;
  const params = lerParametrosPagina({ pagina, tamanho });

  // RF15 — notificações internas. A contagem de não lidas é feita no banco (e
  // não sobre a página atual, que mostra só uma fatia).
  const [itens, total, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { userId: s.sub },
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.notificacao.count({ where: { userId: s.sub } }),
    prisma.notificacao.count({ where: { userId: s.sub, lida: false } }),
  ]);
  const paginaNotif = montarPagina(itens, total, params);
  const notificacoes = paginaNotif.itens;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-sm text-muted">{naoLidas} não lida(s)</p>
        </div>
        {naoLidas > 0 && (
          <form action={marcarTodasLidas}>
            <SubmitButton size="sm" variant="outline" pendingLabel="...">Marcar todas como lidas</SubmitButton>
          </form>
        )}
      </div>

      {notificacoes.length === 0 ? (
        <EmptyState
          icone={<Bell className="h-6 w-6" />}
          titulo="Nenhuma notificação por aqui"
          descricao="Você é avisado quando uma empresa te convidar, publicar um evento novo ou te escalar."
        />
      ) : (
        <div className="space-y-2">
          {notificacoes.map((n) => (
            <Card key={n.id} className={cn("flex items-start justify-between gap-3", !n.lida && "border-brand-500")}>
              <div>
                <p className="font-medium">{n.titulo}</p>
                <p className="text-sm text-muted">{n.mensagem}</p>
                <p className="mt-1 text-xs text-muted" title={formatarDataHora(n.createdAt)}>
                  {formatarRelativo(n.createdAt)}
                </p>
                {n.link && (
                  <Link href={n.link} className="text-xs text-brand-600 hover:underline">Abrir</Link>
                )}
              </div>
              {!n.lida && (
                <form action={marcarNotificacaoLida}>
                  <input type="hidden" name="id" value={n.id} />
                  <SubmitButton size="sm" variant="ghost" pendingLabel="...">Lida</SubmitButton>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}

      {notificacoes.length > 0 && (
        <Paginacao
          pagina={paginaNotif}
          base="/trabalhador/notificacoes"
          filtros={{}}
          singular="notificação"
          plural="notificações"
        />
      )}
    </div>
  );
}
