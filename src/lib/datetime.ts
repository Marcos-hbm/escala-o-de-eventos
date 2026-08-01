/**
 * Data e hora no padrão brasileiro — ponto ÚNICO de formatação do sistema.
 *
 * Funções puras (sem I/O), testáveis offline. Nenhuma outra parte do código deve
 * chamar `toLocaleDateString`/`toLocaleString` direto: `tests/unit/datetime.test.ts`
 * falha se isso acontecer, porque foi exatamente aí que nasceu o bug de fuso
 * descrito abaixo.
 *
 * ## Duas naturezas de valor, dois formatadores
 *
 * 1. **Data civil** — colunas `@db.Date` (`Evento.dataEvento`,
 *    `User.dataNascimento`). Não têm hora nem fuso: "15/08/2026" é o dia do
 *    evento em qualquer lugar do mundo. O Prisma as devolve como `Date` à
 *    meia-noite UTC, então precisam ser formatadas **em UTC** — usar o fuso de
 *    Brasília (UTC-3) as jogaria para o dia anterior (21:00 do dia 14).
 *
 * 2. **Instante** — timestamps (`createdAt`, `updatedAt`, pagamentos,
 *    solicitações). São momentos no tempo, gravados em UTC, e devem ser exibidos
 *    **no fuso de Brasília**. Formatá-los em UTC mostra o dia errado toda noite:
 *    algo criado 30/07 às 21h30 em Brasília é 31/07 00:30 UTC.
 *
 * O Brasil não usa horário de verão desde 2019 (Decreto 9.772/2019), então
 * America/Sao_Paulo é UTC-3 fixo — mas usamos o nome do fuso, e não `-03:00`
 * fixo, para o dia em que isso mudar.
 */

/** Fuso de referência do produto. */
export const FUSO_BRASIL = "America/Sao_Paulo";
export const LOCALE_BR = "pt-BR";

type EntradaData = Date | string | number;

function paraData(valor: EntradaData): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

/** `true` quando a entrada não é uma data utilizável (evita "Invalid Date" na tela). */
export function dataInvalida(valor: EntradaData | null | undefined): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  return Number.isNaN(paraData(valor).getTime());
}

// --------------------------------------------------------------------------
// Data civil (colunas @db.Date) — formatar em UTC
// --------------------------------------------------------------------------

/** Data civil como `DD/MM/AAAA`. Use para `dataEvento`, `dataNascimento`. */
export function formatarDataCivil(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor).toLocaleDateString(LOCALE_BR, { timeZone: "UTC" });
}

/** Data civil por extenso: `15 de agosto de 2026` (cabeçalhos e detalhes). */
export function formatarDataCivilExtensa(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor).toLocaleDateString(LOCALE_BR, {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Dia da semana abreviado da data civil: `sáb`. */
export function formatarDiaSemanaCurto(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor)
    .toLocaleDateString(LOCALE_BR, { timeZone: "UTC", weekday: "short" })
    .replace(".", "");
}

/** `AAAA-MM-DD` para `value`/`defaultValue` de `<input type="date">`. */
export function paraInputDate(valor: EntradaData, vazio = ""): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor).toISOString().slice(0, 10);
}

// --------------------------------------------------------------------------
// Instantes (timestamps) — formatar em America/Sao_Paulo
// --------------------------------------------------------------------------

/** Instante como `DD/MM/AAAA` no fuso de Brasília. */
export function formatarData(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor).toLocaleDateString(LOCALE_BR, { timeZone: FUSO_BRASIL });
}

/** Instante como `HH:mm` no fuso de Brasília (24h). */
export function formatarHora(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return paraData(valor).toLocaleTimeString(LOCALE_BR, {
    timeZone: FUSO_BRASIL,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Dia civil (`AAAA-MM-DD`) de um **instante**, no fuso de Brasília.
 *
 * É o que responde "que dia é hoje aqui?" — diferente de `paraInputDate`, que
 * converte uma data civil e usa UTC. Usar o formatador de data civil para isso
 * produz o dia errado entre 21h e meia-noite (foi um bug real, pego por teste em
 * `estadoDoEvento`).
 */
export function diaCivilBR(valor: EntradaData = new Date()): string {
  if (dataInvalida(valor)) return "";
  const [dia, mes, ano] = formatarData(valor).split("/");
  return `${ano}-${mes}-${dia}`;
}

/** Instante como `DD/MM/AAAA HH:mm` no fuso de Brasília. */
export function formatarDataHora(valor: EntradaData, vazio = "—"): string {
  if (dataInvalida(valor)) return vazio;
  return `${formatarData(valor)} ${formatarHora(valor)}`;
}

// --------------------------------------------------------------------------
// Hora "de parede" (string HH:MM) — Evento.horaInicio e afins
// --------------------------------------------------------------------------

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valida `HH:MM` em 24h. */
export function horaValida(hhmm: string): boolean {
  return RE_HORA.test(hhmm);
}

/** Normaliza entradas como `9:5`, `0930` ou `09h30` para `09:30`; `null` se impossível. */
export function normalizarHora(entrada: string): string | null {
  const limpo = entrada.trim().replace(/[hH.\s]/g, ":").replace(/::+/g, ":");
  const digitos = limpo.replace(/\D/g, "");
  let h: string;
  let m: string;
  if (limpo.includes(":")) {
    const [hh, mm = "0"] = limpo.split(":");
    h = hh;
    m = mm;
  } else if (digitos.length === 4) {
    h = digitos.slice(0, 2);
    m = digitos.slice(2);
  } else if (digitos.length === 3) {
    h = digitos.slice(0, 1);
    m = digitos.slice(1);
  } else if (digitos.length <= 2 && digitos.length > 0) {
    h = digitos;
    m = "0";
  } else {
    return null;
  }
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isInteger(hn) || !Number.isInteger(mn) || hn > 23 || mn > 59 || hn < 0 || mn < 0) {
    return null;
  }
  return `${String(hn).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite, a partir de `HH:MM`. */
export function horaEmMinutos(hhmm: string): number | null {
  if (!horaValida(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** `HH:mm` a partir de minutos desde a meia-noite (aceita passar de 24h com módulo). */
export function minutosEmHora(minutos: number): string {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Duração `HH:MM`→`HH:MM` em minutos; se o fim for menor, assume virada de dia. */
export function duracaoEmMinutos(inicio: string, fim: string): number | null {
  const i = horaEmMinutos(inicio);
  const f = horaEmMinutos(fim);
  if (i === null || f === null) return null;
  return f >= i ? f - i : 1440 - i + f;
}

/** Duração legível: `6h30` / `45min` / `8h`. */
export function formatarDuracao(minutos: number, vazio = "—"): string {
  if (!Number.isFinite(minutos) || minutos < 0) return vazio;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Período trabalhado: `14:30–18:00 (3h30)`. */
export function formatarPeriodo(inicio: string, fim: string, vazio = "—"): string {
  if (!horaValida(inicio) || !horaValida(fim)) return vazio;
  const dur = duracaoEmMinutos(inicio, fim);
  return `${inicio}–${fim}${dur !== null ? ` (${formatarDuracao(dur)})` : ""}`;
}

/**
 * Combina uma data civil (`@db.Date`) com uma hora de parede `HH:MM` no fuso de
 * Brasília e devolve o instante correspondente (UTC internamente).
 * Base para check-in/check-out e para o horário efetivo do evento.
 *
 * Offset fixo -03:00: correto desde a extinção do horário de verão (2019). Se o
 * país voltar a adotá-lo, este é o ponto único a corrigir.
 */
export function instanteDeDataHoraBR(dataCivil: EntradaData, hhmm: string): Date | null {
  if (dataInvalida(dataCivil) || !horaValida(hhmm)) return null;
  const dia = paraInputDate(dataCivil);
  return new Date(`${dia}T${hhmm}:00.000-03:00`);
}

// --------------------------------------------------------------------------
// Tempo relativo (notificações, solicitações "em tempo real")
// --------------------------------------------------------------------------

/**
 * Tempo relativo curto: `agora`, `há 5 min`, `há 3 h`, `ontem`, `há 4 dias`.
 * `agora` é injetado para o resultado ser determinístico em teste.
 */
export function formatarRelativo(valor: EntradaData, agora: EntradaData = new Date()): string {
  if (dataInvalida(valor)) return "—";
  const alvo = paraData(valor).getTime();
  const base = paraData(agora).getTime();
  const difSeg = Math.round((base - alvo) / 1000);

  if (difSeg < 0) return formatarDataHora(valor); // futuro: mostra a data cheia
  if (difSeg < 60) return "agora";
  const min = Math.floor(difSeg / 60);
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return formatarData(valor);
}
