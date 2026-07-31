import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Estado vazio padrão: ícone, o que aconteceu e **o próximo passo**.
 *
 * Regra adotada: um empty state sem ação é só um texto triste. Quando existe algo
 * que o usuário pode fazer (criar evento, ajustar filtro), a ação vem junto; quando
 * o vazio é esperado e não há ação (ex.: nenhuma notificação), passa-se só a
 * descrição.
 */
export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: { href: string; rotulo: string };
  className?: string;
}) {
  return (
    <Card className={className} data-testid="empty-state">
      <div className="flex flex-col items-center px-4 py-8 text-center">
        {icone && (
          <span
            aria-hidden="true"
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-700/20 dark:text-brand-100"
          >
            {icone}
          </span>
        )}
        <p className="font-medium">{titulo}</p>
        {descricao && <p className="mt-1 max-w-md text-sm text-muted">{descricao}</p>}
        {acao && (
          <Link href={acao.href} className="mt-4">
            <Button size="sm">{acao.rotulo}</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
