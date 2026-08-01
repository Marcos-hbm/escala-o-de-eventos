/**
 * Comunicação do evento (v4, itens 7 e 8) — **funções puras**.
 *
 * Duas regras moram aqui porque são a espinha do módulo e precisam de teste
 * exaustivo:
 *
 * 1. **quando** o canal existe (o módulo só vale com o evento em andamento);
 * 2. **para onde** uma solicitação pode ir (transições de status válidas).
 */
import { diaCivilBR, paraInputDate } from "../datetime";

export type TipoSolicitacaoId =
  | "INTERVALO"
  | "DESCANSO"
  | "PROBLEMA"
  | "AJUDA"
  | "SUBSTITUICAO"
  | "FALAR_COORDENACAO";

export type StatusSolicitacaoId = "EM_ANALISE" | "AGUARDANDO" | "APROVADA" | "RECUSADA" | "FINALIZADA";

export interface DefinicaoTipo {
  id: TipoSolicitacaoId;
  rotulo: string;
  descricao: string;
  /** Pedidos urgentes vão primeiro na fila do coordenador. */
  urgente: boolean;
}

/** Ordem de exibição dos botões para o trabalhador. */
export const TIPOS_SOLICITACAO: DefinicaoTipo[] = [
  { id: "INTERVALO", rotulo: "Solicitar intervalo", descricao: "Pausa curta durante o turno.", urgente: false },
  { id: "DESCANSO", rotulo: "Solicitar descanso", descricao: "Pausa maior, por cansaço.", urgente: false },
  { id: "PROBLEMA", rotulo: "Informar problema", descricao: "Algo errado no posto de trabalho.", urgente: true },
  { id: "AJUDA", rotulo: "Pedir ajuda", descricao: "Precisa de apoio agora.", urgente: true },
  {
    id: "SUBSTITUICAO",
    rotulo: "Solicitar substituição",
    descricao: "Não pode continuar e precisa ser substituído.",
    urgente: true,
  },
  {
    id: "FALAR_COORDENACAO",
    rotulo: "Falar com coordenação",
    descricao: "Assunto que precisa de conversa.",
    urgente: false,
  },
];

export const ROTULOS_STATUS_SOLICITACAO: Record<StatusSolicitacaoId, string> = {
  EM_ANALISE: "Em análise",
  AGUARDANDO: "Aguardando",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  FINALIZADA: "Finalizada",
};

export const TOM_STATUS_SOLICITACAO: Record<StatusSolicitacaoId, "info" | "warning" | "success" | "danger" | "neutral"> =
  {
    EM_ANALISE: "info",
    AGUARDANDO: "warning",
    APROVADA: "success",
    RECUSADA: "danger",
    FINALIZADA: "neutral",
  };

/** Status que ainda esperam ação do coordenador (contador do painel). */
export const STATUS_ABERTOS: StatusSolicitacaoId[] = ["EM_ANALISE", "AGUARDANDO"];

export function ehTipoSolicitacao(v: unknown): v is TipoSolicitacaoId {
  return typeof v === "string" && TIPOS_SOLICITACAO.some((t) => t.id === v);
}

export function definicaoTipo(id: TipoSolicitacaoId): DefinicaoTipo {
  return TIPOS_SOLICITACAO.find((t) => t.id === id)!;
}

// --------------------------------------------------------------------------
// Estado do evento — define se o canal de comunicação existe
// --------------------------------------------------------------------------

export type EstadoEvento = "FUTURO" | "EM_ANDAMENTO" | "ENCERRADO";

/**
 * Estado do evento a partir da **data civil** e do status.
 *
 * "Em andamento" = acontece hoje (no fuso de Brasília) e não foi finalizado nem
 * cancelado. Comparamos data civil com data civil de propósito: `dataEvento` é
 * `@db.Date` (dia sem hora), e comparar com instante criaria janelas erradas de
 * madrugada — o mesmo bug de fuso que motivou `lib/datetime.ts`.
 *
 * `agora` entra por parâmetro para o teste ser determinístico.
 */
export function estadoDoEvento(
  dataEvento: Date | string,
  status: string,
  agora: Date = new Date(),
): EstadoEvento {
  if (status === "FINALIZADO" || status === "CANCELADO") return "ENCERRADO";

  const diaEvento = paraInputDate(dataEvento);
  // "Hoje" tem de ser o dia civil em BRASÍLIA, não em UTC: entre 21h e meia-noite o
  // UTC já virou o dia seguinte e o evento de hoje seria dado como encerrado.
  const hoje = diaCivilBR(agora);

  if (diaEvento === hoje) return "EM_ANDAMENTO";
  return diaEvento > hoje ? "FUTURO" : "ENCERRADO";
}

/** Mensagem para quando o canal não está disponível — diz por quê. */
export function motivoCanalIndisponivel(estado: EstadoEvento): string | null {
  if (estado === "EM_ANDAMENTO") return null;
  return estado === "FUTURO"
    ? "A comunicação com a coordenação abre no dia do evento."
    : "O evento foi encerrado. O histórico da comunicação continua disponível.";
}

// --------------------------------------------------------------------------
// Transições de status
// --------------------------------------------------------------------------

/**
 * Para onde o coordenador pode levar uma solicitação.
 *
 * - de EM_ANALISE: aprovar, recusar ou pedir para aguardar;
 * - de AGUARDANDO: aprovar, recusar ou finalizar (o pedido perdeu o objeto);
 * - de APROVADA: finalizar (intervalo terminou, ajuda foi prestada);
 * - RECUSADA e FINALIZADA são estados terminais — reabrir viraria histórico
 *   confuso; o trabalhador abre uma nova solicitação.
 */
export function transicoesPermitidas(status: StatusSolicitacaoId): StatusSolicitacaoId[] {
  switch (status) {
    case "EM_ANALISE":
      return ["APROVADA", "RECUSADA", "AGUARDANDO"];
    case "AGUARDANDO":
      return ["APROVADA", "RECUSADA", "FINALIZADA"];
    case "APROVADA":
      return ["FINALIZADA"];
    case "RECUSADA":
    case "FINALIZADA":
      return [];
  }
}

export function transicaoValida(de: StatusSolicitacaoId, para: StatusSolicitacaoId): boolean {
  return transicoesPermitidas(de).includes(para);
}

export function ehStatusTerminal(status: StatusSolicitacaoId): boolean {
  return transicoesPermitidas(status).length === 0;
}

/** Mensagem de recusa da transição — diz o que ainda é possível. */
export function mensagemTransicaoInvalida(de: StatusSolicitacaoId, para: StatusSolicitacaoId): string {
  const possiveis = transicoesPermitidas(de);
  if (possiveis.length === 0) {
    return `Esta solicitação está ${ROTULOS_STATUS_SOLICITACAO[de].toLowerCase()} e não muda mais. O trabalhador pode abrir uma nova.`;
  }
  return `Não é possível ir de "${ROTULOS_STATUS_SOLICITACAO[de]}" para "${ROTULOS_STATUS_SOLICITACAO[para]}". Possíveis agora: ${possiveis
    .map((p) => ROTULOS_STATUS_SOLICITACAO[p])
    .join(", ")}.`;
}

/**
 * Ordena a fila do coordenador: primeiro o que espera ação, urgentes na frente,
 * e dentro do mesmo grupo o mais antigo primeiro (quem pediu antes é atendido
 * antes).
 */
export function ordenarFila<T extends { tipo: TipoSolicitacaoId; status: StatusSolicitacaoId; createdAt: Date }>(
  solicitacoes: T[],
): T[] {
  const peso = (s: T) => {
    const aberta = STATUS_ABERTOS.includes(s.status) ? 0 : 1;
    const urgencia = definicaoTipo(s.tipo).urgente ? 0 : 1;
    return aberta * 10 + urgencia;
  };
  return [...solicitacoes].sort((a, b) => peso(a) - peso(b) || a.createdAt.getTime() - b.createdAt.getTime());
}

// --------------------------------------------------------------------------
// Presença (check-in / check-out) — item 8
// --------------------------------------------------------------------------

export type EstadoPresenca = "AGUARDANDO_CHECKIN" | "EM_TURNO" | "TURNO_ENCERRADO";

export function estadoPresenca(checkIn: Date | null, checkOut: Date | null): EstadoPresenca {
  if (checkOut) return "TURNO_ENCERRADO";
  return checkIn ? "EM_TURNO" : "AGUARDANDO_CHECKIN";
}

export const ROTULOS_PRESENCA: Record<EstadoPresenca, string> = {
  AGUARDANDO_CHECKIN: "Aguardando check-in",
  EM_TURNO: "Em turno",
  TURNO_ENCERRADO: "Turno encerrado",
};

/** Minutos entre check-in e check-out (ou até `agora`, se ainda em turno). */
export function minutosEmTurno(checkIn: Date | null, checkOut: Date | null, agora: Date = new Date()): number | null {
  if (!checkIn) return null;
  const fim = checkOut ?? agora;
  const min = Math.round((fim.getTime() - checkIn.getTime()) / 60000);
  return min >= 0 ? min : null;
}
