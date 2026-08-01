# ADR 0004 — Atualização de tela após server action

- **Status:** aceito; a causa do residual foi identificada em 2026-08-01 (ver "Terceira rodada")
- **Data:** 2026-07-31 · atualizado em 2026-08-01
- **Contexto da versão:** v4, fase 1; atualizado na fase 6
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

## Terceira rodada (2026-08-01): a fronteira de streaming do segmento

Na verificação da fase 6 a suíte completa passou 123/123 três vezes, mas ao repetir
**só** o grupo "Plano e assinatura" o defeito apareceu com frequência que nenhuma
medição anterior tinha capturado: **4 de 10 rodadas com falha**. Com a mudança de
código daquele momento revertida (`git stash`) e rebuild, a taxa se manteve — logo,
não era regressão nova, e sim algo estrutural da tela.

Harness de medição: 16 iterações independentes do fluxo (criar empresa → login →
`/empresa/plano` → clicar "Mudar para Professional"), paralelizadas em 2 workers como
na suíte real, cada uma comparando **tela × banco** e registrando se o `POST` da
action foi pelo caminho do router (cabeçalho `next-action`) ou nativo.

| Variante (tudo o mais igual) | Tela velha |
| --- | --- |
| Trocar plano — como estava, segmento com `loading.tsx` | 4 de 16 |
| Trocar plano — sem o `revalidatePath` de rota diferente (`/empresa/equipe`) | 3 de 16 |
| **Trocar plano — sem `loading.tsx` no segmento** | **0 de 48** (3 rodadas) |
| Trocar plano — grupo "Plano e assinatura" completo, sem `loading.tsx` | **0 de 10 rodadas** (antes 4 de 10) |

Repetimos o mesmo harness numa segunda tela com a mesma combinação (`loading.tsx` +
formulário mutante renderizado no servidor), depois que a suíte completa acusou uma
falha justamente nela:

| Convidar trabalhador (`/empresa/vinculos`) | Tela velha |
| --- | --- |
| Com `loading.tsx` | 5 de 64 (4 rodadas: 0, 2, 2, 1) |
| **Sem `loading.tsx`** | **0 de 64** (4 rodadas) |

E medimos as duas telas que têm `loading.tsx` e **não** apresentaram o defeito, para
não removê-lo por superstição:

| Tela (com `loading.tsx` mantido) | Tela velha |
| --- | --- |
| Equipe — adicionar membro | 0 de 64 |
| Notificações — marcar todas como lidas | 0 de 64 |

Em **todas** as falhas: `db=PROFESSIONAL`, `PLANO_ALTERADO` gravado na auditoria,
`POST` pelo caminho do router (`next-action` presente, resposta 303), nenhum erro de
console — e um `reload` já mostrava o valor novo. Ou seja: a troca acontece, o cliente
descarta o resultado.

**Hipóteses descartadas nesta rodada, por medição:**

- *`revalidatePath` de outra rota antes do `redirect`* → removido, 3 de 16 (sem
  efeito); restaurado, porque é ele que atualiza a cota exibida em Equipe;
- *clique antes da hidratação* → o cabeçalho `next-action` estava presente em todas
  as iterações, inclusive nas que falharam: o React já havia assumido o formulário;
- *`loading.tsx` é ruim em qualquer tela* → **não**. Equipe e Notificações têm
  `loading.tsx` e formulário mutante e não reproduzem (0 de 64 cada);
- *dado lento faz a fronteira "suspender" e abrir a janela do defeito* → inserimos
  300 ms de atraso artificial na página de Notificações (que tem `loading.tsx`):
  0 de 12. Hipótese rejeitada.

Por que em duas telas e não nas outras duas, não sabemos — o gatilho interno do router segue sem
explicação, e é isso que será reportado ao projeto Next. O que está medido e é
suficiente para decidir: **naquele segmento, a fronteira de streaming era condição
necessária para o defeito.**

### Decisão

Removidos `src/app/empresa/plano/loading.tsx` e `src/app/empresa/vinculos/loading.tsx`
— as duas telas em que o defeito foi medido. O skeleton **continua** onde medimos que
não faz mal (Equipe, Notificações) e nas telas que só leem dados (os dois painéis).
Não estendemos a remoção por analogia: `trabalhador/historico` não foi medido e ficou
como está.

Como a correção é a **ausência** de um arquivo — invisível numa revisão de código —,
ela tem guarda de regressão em `tests/unit/fronteiras-loading.test.ts`, que fixa as
duas listas (sem skeleton / com skeleton), e comentário no cabeçalho das duas páginas.

Custo aceito: sem `loading.tsx`, a navegação para essas duas telas espera a consulta
ao banco antes de pintar (Plano: uma assinatura + três contagens) em vez de mostrar
skeleton. Correção do que a tela informa vale mais do que percepção de velocidade.

## O que ainda falha

Depois das duas remoções, os fluxos que concentravam o defeito estão em 0 de 48
(trocar plano) e 0 de 64 (convidar). **Não afirmamos que o residual acabou**: o
gatilho no router não foi explicado, apenas removido dessas telas. Na suíte completa
o sintoma nunca passou de 0 a 1 em 125 testes por rodada, sempre com o banco correto —
qualquer navegação mostra o estado atual.

Medição de referência para comparar no futuro: harness de 16 iterações do fluxo
sensível, 2 workers, build de produção, comparando tela × banco em cada iteração.

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

1. ~~atualizar o Next e repetir o loop instrumentado~~ — **feito**: melhora, não
   resolve. ~~Isolar a variável que faltava no fluxo mais sensível~~ — **feito** na
   terceira rodada: era o `loading.tsx` do segmento;
2. `router.refresh()` explícito no cliente após a action (exige componente cliente
   em volta de cada formulário — custo de arquitetura a avaliar);
3. transformar as mutações em navegação de página inteira, sem interceptação do
   router (`<form method="post">` para route handler), abrindo mão de action
   tipada;
4. reportar o comportamento ao projeto Next com o loop reprodutível — agora com um
   caso mínimo bem mais forte: mesma página, mesma action, `loading.tsx` presente
   (4 de 16 e 5 de 64) versus ausente (0 de 48 e 0 de 64);
5. entender por que Equipe e Notificações não reproduzem: é a diferença que aponta o
   gatilho real dentro do router.

Enquanto isso, nenhuma decisão de produto depende do caminho quebrado: o dado é
sempre gravado, e as telas críticas (excluir evento, vínculos, presença,
notificações) já passaram para o caminho determinístico.
