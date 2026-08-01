"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

/**
 * Atualização periódica da tela (item 7: "o coordenador receberá em tempo real").
 *
 * **Por que polling e não WebSocket/SSE:** decisão registrada no início da v4 —
 * polling não exige infraestrutura nova, funciona em qualquer deploy (inclusive
 * serverless) e é determinístico no teste. Toda a lógica de "tempo real" está
 * isolada neste componente: trocar por SSE/WebSocket depois mexe só aqui.
 *
 * Além do ciclo automático, existe **link explícito de atualizar**: é uma navegação
 * de verdade, então funciona mesmo quando o refresh do router não é aplicado
 * (ADR 0004) e serve a quem prefere controlar quando a tela muda.
 */
export function AtualizacaoAutomatica({
  intervaloSegundos = 15,
  caminho,
}: {
  intervaloSegundos?: number;
  /** URL usada pelo link de atualizar (mantém filtros da tela). */
  caminho: string;
}) {
  const router = useRouter();
  const [segundos, setSegundos] = useState(intervaloSegundos);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!ativo) return;
    const tick = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          router.refresh();
          return intervaloSegundos;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [ativo, intervaloSegundos, router]);

  return (
    <div
      className="flex flex-wrap items-center gap-3 text-xs text-muted"
      data-testid="atualizacao-automatica"
      data-intervalo={intervaloSegundos}
      data-ativo={ativo ? "true" : "false"}
    >
      <span aria-live="off">
        {ativo ? `Atualiza em ${segundos}s` : "Atualização automática pausada"}
      </span>
      <button
        type="button"
        onClick={() => setAtivo((a) => !a)}
        className="underline hover:no-underline"
        aria-label={ativo ? "Pausar atualização automática" : "Retomar atualização automática"}
      >
        {ativo ? "pausar" : "retomar"}
      </button>
      <Link
        href={caminho}
        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
        data-testid="atualizar-agora"
      >
        <RefreshCw className="h-3 w-3" /> Atualizar agora
      </Link>
    </div>
  );
}
