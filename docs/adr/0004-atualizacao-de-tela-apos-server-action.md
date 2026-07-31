# ADR 0004 — Atualização de tela após server action: redirecionar, não confiar só em `revalidatePath`

- **Status:** parcialmente implementado (ver "Situação atual")
- **Data:** 2026-07-31
- **Contexto da versão:** v4, fase 1

## Contexto

Ao instrumentar o fluxo de mutações contra o **build de produção**, encontramos um
comportamento que a suíte E2E vinha expondo como falha intermitente:

> a mutação é gravada no banco, o `POST` da server action responde **200**, e a
> tela continua exibindo o estado anterior — sem erro no console, sem exceção no
> servidor.

Medições (loop automatizado, servidor de produção local + PostgreSQL 16):

| Fluxo | Antes | Depois da mudança aplicada |
| --- | --- | --- |
| Excluir evento com a lista sob `<Suspense>` | 5 de 6 execuções ficavam com tela velha | — (padrão abandonado) |
| Excluir evento consultando no corpo da página | — | 6 de 6 atualizaram |
| Recusar vínculo (action `void` + `revalidatePath`) | 1 de 8 com tela velha | 8 de 8 atualizaram (com `redirect`) |
| Trocar plano (action com `ActionState` + toast) | 2 a 5 de 8 com tela velha | **ainda reproduz** |

Dois achados distintos saíram daí:

1. **Consulta dentro de `<Suspense>` na mesma rota da mutação** não era recomposta
   após `revalidatePath`. Abandonado: as listas voltaram a consultar no corpo da
   página. (`loading.tsx` de segmento também não serve nas rotas com `[id]`, pois
   o shell 200 é enviado antes de `notFound()` e o IDOR passaria a responder 200.)
2. Ações que **não redirecionam** dependem de o cliente aplicar a resposta da
   action. Quando isso não acontece, o usuário vê dado velho até navegar.

## Decisão

- Ações de mutação que retornam `void` terminam com `voltarParaOrigem(fallback)`
  (`server/actions/navegacao.ts`): redireciona para a página de origem — obtida do
  header `Referer`, validado como caminho **interno** (`lib/navegacao.ts`, com
  teste unitário cobrindo open redirect) — preservando filtros e paginação da URL.
  Isso troca "esperar que o cliente aplique a atualização" por uma navegação nova,
  que é determinística e funciona sem JavaScript.
- Consultas de listagem ficam no corpo da página, não em componente sob
  `<Suspense>` na mesma rota que sofre mutação.

## Situação atual (honesta)

O caso de ações que retornam `ActionState` e exibem **toast** (trocar plano,
gerenciar equipe, avaliar) **continua reproduzindo** a tela velha em parte das
execuções: nessas, o toast também não aparece, porque ambos dependem da resposta
da action ser aplicada no cliente. O dado no banco está sempre correto e qualquer
navegação/refresh mostra o estado atual.

Direção proposta para a próxima fase (não implementada aqui porque muda o padrão
de feedback de todas as telas):

- essas actions passam a **redirecionar** também, carregando a mensagem na URL
  (`?aviso=...`), e um componente de servidor renderiza a faixa de confirmação;
- o toast fica como enfeite para quem tem JS, e o feedback deixa de depender dele;
- erros de validação de campo continuam inline, como hoje.

## Consequências

- Determinismo nas mutações sem `ActionState`, e um caminho claro (com medição)
  para eliminar o resto.
- Um redirecionamento a mais por mutação: custo irrelevante (páginas dinâmicas
  respondem em ~10 ms neste ambiente) diante de exibir dado errado.
- A suíte E2E deixa de ser "flaky sem explicação": o que sobra de instabilidade
  está localizado, medido e documentado acima.
