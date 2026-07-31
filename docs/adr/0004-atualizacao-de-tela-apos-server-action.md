# ADR 0004 — Atualização de tela após server action

- **Status:** aceito com limitação conhecida (ver "O que ainda falha")
- **Data:** 2026-07-31
- **Contexto da versão:** v4, fase 1
- **Ambiente das medições:** Next.js 15.5.21, build de produção (`next start`), PostgreSQL 16 em Docker, Chromium

## Contexto

A suíte E2E vinha acusando falhas intermitentes em telas que dependem de uma
mutação. Instrumentando o fluxo (rede + console + banco a cada rodada), o sintoma
é sempre o mesmo:

> a mutação é gravada, o `POST` da server action responde **200**, e a tela
> continua exibindo o estado anterior — sem erro no console do navegador, sem
> exceção no servidor.

## Medições

| Fluxo | Antes | Depois |
| --- | --- | --- |
| Excluir evento, lista sob `<Suspense>` na mesma rota | 5 de 6 execuções com tela velha | padrão abandonado |
| Excluir evento, consulta no corpo da página | — | 6 de 6 atualizaram |
| Recusar vínculo (action `void` + `revalidatePath`) | 1 de 8 com tela velha | 8 de 8 com `redirect` de volta |
| Trocar plano (sucesso, com `ActionState` + toast) | 2 a 5 de 8 com tela velha | reduzido, **não eliminado** |

## Decisões aplicadas

1. **Consulta de listagem não fica sob `<Suspense>` na mesma rota que sofre
   mutação.** Também não usamos `loading.tsx` nos segmentos que têm filhos `[id]`:
   o shell 200 é enviado antes de `notFound()`, e o IDOR passaria a responder 200
   em vez de 404 (regressão de segurança verificada em teste).
2. **Ações de mutação redirecionam de volta à origem** (`voltarParaOrigem`), com o
   destino lido do `Referer` e validado como caminho interno (`lib/navegacao.ts`,
   com teste de open redirect). Uma navegação nova é determinística e funciona sem
   JavaScript.
3. **Feedback de sucesso viaja na URL** (`lib/flash.ts` + `components/ui/flash.tsx`)
   e é renderizado **no servidor**, no mesmo render que traz os dados novos: não
   existe "dado novo sem aviso" nem "aviso sem dado novo". O fechar é um link.
4. **Recusa por regra de negócio continua inline no formulário** (`ActionState`).
   Testado redirecionar também nesse caso: como a recusa não escreve nada, o
   cliente reaproveita a página do próprio cache, ignora a query nova e o aviso
   não aparece — a URL ficava com `?erro_op=...` e a faixa não renderizava.
   Revalidar dentro do helper antes do `redirect` piorou (a URL perdia o
   parâmetro). Como recusa não altera dado, mensagem inline é suficiente e
   previsível.
5. **Toast deixa de ser canal de resultado de server action.** O componente
   permanece para confirmações puramente de cliente (ex.: "chave PIX copiada", na
   fase 3).

## O que ainda falha

Em parte das execuções (0 a 2 em 87 testes por rodada), o cliente não aplica o
resultado da action — inclusive quando ele é um `redirect`. Nesses casos o banco
está correto e qualquer navegação mostra o estado atual.

**Hipóteses testadas e descartadas por medição:**

- prefetch do menu concorrendo com a action → `prefetch={false}` nos itens do menu
  não mudou o índice (mantido, por reduzir 6–7 requisições RSC por visita);
- esgotamento do pool do Prisma → 8 conexões de 100, nenhum "timed out fetching";
- volume de dados acumulado pelos testes → reproduz com base recém-semeada;
- paralelismo do Playwright → reproduz com `--workers=1`;
- build corrompido (`.next` compartilhado entre `next dev` e `next start`) → causa
  **real** de uma leva de falhas anteriores (todos os assets `/_next/static/*`
  respondiam 400 e a app nunca hidratava); eliminado rodando sempre com
  `E2E_BASE_URL` apontando para um build limpo. As medições da tabela acima são
  posteriores a essa descoberta ou anteriores à contaminação;
- clique antes da hidratação → real e corrigido no harness (`irPara()` espera o
  marcador `data-hidratado`), mas não explica o residual.

**Próximos passos propostos** (nesta ordem, com medição a cada etapa):

1. atualizar o Next (15.5.21 → versão atual) num branch e repetir o loop
   instrumentado — o sintoma tem cara de comportamento do router, não de código de
   aplicação;
2. se persistir, `router.refresh()` explícito no cliente após a action;
3. como último recurso, transformar as mutações em navegação de página inteira
   (formulário sem interceptação do router).

Enquanto isso, nenhuma decisão de produto depende do caminho quebrado: o dado é
sempre gravado, e as telas críticas (excluir evento, vínculos, presença,
notificações) já passaram para o caminho determinístico.
