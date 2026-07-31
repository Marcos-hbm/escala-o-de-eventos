# ADR 0003 — Data e hora: padrão brasileiro com distinção entre data civil e instante

- **Status:** aceito
- **Data:** 2026-07-31
- **Contexto da versão:** v4, fase 1

## Contexto

O sistema exibia datas com `formatData()` (`lib/utils.ts`), que fazia
`toLocaleDateString("pt-BR", { timeZone: "UTC" })`. O formato já era `DD/MM/AAAA`,
mas o fuso fixo em UTC estava **certo para um tipo de valor e errado para outro**:

- `Evento.dataEvento` e `User.dataNascimento` são `@db.Date` — data civil, sem
  hora. O Prisma as entrega como meia-noite UTC; formatar em `America/Sao_Paulo`
  (UTC-3) mostraria o **dia anterior** (21:00 do dia 14 em vez de 15).
- `createdAt`, `updatedAt` e todos os carimbos futuros (pagamentos, solicitações)
  são instantes gravados em UTC. Formatá-los em UTC mostra o **dia errado toda
  noite**: algo criado 30/07 às 21h30 em Brasília é 31/07 00:30 UTC.

Havia 57 pontos no código tocando data/hora e nenhuma formatação de **hora**.

## Decisão

Um módulo único e puro, `lib/datetime.ts`, com dois formatadores distintos e
nomes que impedem confusão:

| Natureza | Função | Fuso usado |
| --- | --- | --- |
| Data civil (`@db.Date`) | `formatarDataCivil`, `formatarDataCivilExtensa`, `formatarDiaSemanaCurto`, `paraInputDate` | UTC |
| Instante (timestamp) | `formatarData`, `formatarHora`, `formatarDataHora`, `formatarRelativo` | `America/Sao_Paulo` |
| Hora de parede (`HH:MM`) | `horaValida`, `normalizarHora`, `duracaoEmMinutos`, `formatarDuracao`, `formatarPeriodo`, `instanteDeDataHoraBR` | — |

Regras que acompanham a decisão:

1. **Nenhum outro arquivo formata data/hora.** `tests/unit/datetime.test.ts` varre
   `src/` e falha se aparecer `toLocaleDateString`/`toLocaleTimeString`/
   `toLocaleString("pt-BR"` fora da lista permitida. Foi exatamente a formatação
   espalhada que produziu o bug.
2. `formatarRelativo` recebe o "agora" por parâmetro, para o teste ser
   determinístico.
3. Exportação CSV também em padrão BR: data `DD/MM/AAAA`, número com vírgula
   decimal e separador `;` (Excel pt-BR).
4. O offset de Brasília aparece **uma vez**, em `instanteDeDataHoraBR` (`-03:00`),
   válido desde a extinção do horário de verão (Decreto 9.772/2019). Se o país
   voltar a adotá-lo, é o único ponto a corrigir.

## Consequências

**Positivas**

- O bug de fuso deixa de ser possível por descuido: só há um lugar que formata, e
  um teste que bloqueia o desvio.
- Datas civis não deslocam, instantes aparecem no horário de Brasília, e existe
  formatação de hora/duração para o módulo financeiro e de comunicação (fases
  seguintes) reaproveitarem.
- Notificações passam a mostrar tempo relativo ("há 15 min") com a data/hora
  completa no `title`.

**Negativas / limites aceitos**

- `<input type="date">` exibe no formato do **navegador/SO** (pode aparecer
  `mm/dd/yyyy` num ambiente en-US) — isso não é controlável por HTML/CSS. Mantido
  o input nativo (acessível, teclado numérico no mobile, sem JS); a alternativa
  seria um campo mascarado `dd/mm/aaaa` com parsing próprio, com custo de
  acessibilidade.
- O sistema assume um único fuso (o do Brasil). Operação multi-país exigiria fuso
  por empresa e a troca de `FUSO_BRASIL` por esse dado — o módulo já concentra o
  ponto de mudança.
