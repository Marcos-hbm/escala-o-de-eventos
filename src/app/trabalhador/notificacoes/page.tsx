import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/server/actions/perfil";
import { formatData } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notificações — Escala" };

export default async function Notificacoes() {
  const s = await requireTrabalhador();

  // RF15 — notificações internas.
  const notificacoes = await prisma.notificacao.findMany({
    where: { userId: s.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

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
        <Card className="text-sm text-muted">Nenhuma notificação.</Card>
      ) : (
        <div className="space-y-2">
          {notificacoes.map((n) => (
            <Card key={n.id} className={cn("flex items-start justify-between gap-3", !n.lida && "border-brand-500")}>
              <div>
                <p className="font-medium">{n.titulo}</p>
                <p className="text-sm text-muted">{n.mensagem}</p>
                <p className="mt-1 text-xs text-muted">{formatData(n.createdAt)}</p>
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
    </div>
  );
}
