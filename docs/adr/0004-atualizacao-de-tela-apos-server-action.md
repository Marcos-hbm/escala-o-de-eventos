# ADR 0004 — Atualização de tela após server action

- **Status:** aceito com limitação conhecida (ver "O que ainda falha")
- **Data:** 2026-07-31
- **Contexto da versão:** v4, fase 1
- **Ambiente das medições:** build de produção (`next start`), PostgreSQL 16 em Docker, Chromium; Next.js 15.5.21 e, na segunda rodada de investigação, 16.2.12

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
4. **Recusa por regra de negócio também sai por flash** (`?erro_op=`), depois que a
   descoberta do redirect-para-a-mesma-URL foi corrigida. No Next 15 isso não
   funcionava — a URL ficava com o parâmetro e a faixa não renderizava, e
   revalidar dentro do helper antes do `redirect` piorava (a URL perdia o
   parâmetro); no Next 16, com a URL diferindo, funciona. **Erros de validação de
   campo continuam inline** (`ActionState` + `fieldErrors`), ao lado do input:
   navegar para dizer "e-mail inválido" perderia o que a pessoa digitou.
5. **Toast deixa de ser canal de resultado de server action.** O componente
   permanece para confirmações puramente de cliente (ex.: "chave PIX copiada", na
   fase 3).

## Investigação com Next 16 (branch `investigacao/next-upgrade`)

Atualizamos 15.5.21 → **16.2.12** e repetimos as medições. O build passou sem
mudança de código (typecheck limpo, 93/93 unitários).

| Cenário (12 execuções cada, salvo indicado) | Next 15.5.21 | Next 16.2.12 |
| --- | --- | --- |
| Trocar plano — `useActionState` + toast | 2 a 5 de 8 com tela velha | — |
| Trocar plano — `useActionState` + flash | — | 3 de 12 |
| Trocar plano — formulário simples em client component + flash | — | 1 de 12 |
| Trocar plano — formulário renderizado no servidor + flash | — | 2 de 12 |
| Responder vínculo — formulário no servidor + flash | 1 de 8 (sem flash) | **0 de 12** |
| Suíte E2E completa (87 testes), 3 rodadas | 2, 2, 0 falhas | **0, 1, 0 falhas** |

Leituras:

- o Next 16 **reduz** a incidência (de ~2 falhas por rodada para ~0,3), mas não
  elimina;
- dar mensagem de flash às ações `void` ajudou de verdade: sem ela o redirect ia
  para a **mesma URL**, e navegar para a URL atual é um no-op para o router — o
  fluxo de vínculo saiu de 1/8 para 0/12;
- as variações de onde o formulário mora (client vs server component) e de
  `useActionState` vs formulário simples ficaram dentro do ruído entre 1 e 3 de 12,
  ou seja: não são a causa raiz. Mantivemos as versões mais simples (formulário no
  servidor, sem `useActionState` onde não há erro de campo) porque são melhores por
  outros motivos, não porque resolvem isso.

## O que ainda falha

Em parte das execuções (com Next 16: 0 a 1 em 87 testes por rodada; no loop
dirigido ao fluxo mais sensível, ~1 a 2 em 12), o cliente não aplica o resultado da
action — inclusive quando ele é um `redirect` para URL diferente. Nesses casos o
banco está correto e qualquer navegação mostra o estado atual.

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

1. ~~atualizar o Next e repetir o loop instrumentado~~ — **feito** (tabela acima):
   melhora, não resolve;
2. `router.refresh()` explícito no cliente após a action (exige componente cliente
   em volta de cada formulário — custo de arquitetura a avaliar);
3. transformar as mutações em navegação de página inteira, sem interceptação do
   router (`<form method="post">` para route handler), abrindo mão de action
   tipada;
4. reportar o comportamento ao projeto Next com o loop reprodutível — o sintoma
   (POST 200, mutação aplicada, cliente não atualiza, sem erro) tem cara de bug do
   router, não de código de aplicação.

Enquanto isso, nenhuma decisão de produto depende do caminho quebrado: o dado é
sempre gravado, e as telas críticas (excluir evento, vínculos, presença,
notificações) já passaram para o caminho determinístico.
