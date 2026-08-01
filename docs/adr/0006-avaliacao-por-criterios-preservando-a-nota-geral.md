# ADR 0006 — Avaliação por critérios preservando a nota geral

- **Status:** aceito
- **Data:** 2026-08-01
- **Contexto da versão:** v4, fase 4

## Contexto

A v2 já tinha avaliação bidirecional com **uma nota** de 1 a 5 (`Avaliacao.nota`), e
essa coluna alimenta duas coisas que funcionam hoje:

- `lib/reputacao.ts` — reputação exibida em perfis, painéis e na escala;
- `scorePrioridade` (`lib/stats.ts`) — a ordenação da escalação inteligente.

A v4 (item 3) pede avaliação em cinco critérios: pontualidade, comunicação, trabalho
em equipe, qualidade e comprometimento.

Alternativas consideradas:

1. **Manter `nota` como nota geral derivada** (média dos critérios) e adicionar cinco
   colunas nullable.
2. Substituir `nota` pelos cinco critérios e recalcular reputação/score a partir
   deles.
3. Criar tabela `AvaliacaoCriterio` (uma linha por critério).

## Decisão

Adotada a **alternativa 1**: `nota` continua existindo e passa a ser a **média
arredondada** dos critérios informados; os cinco critérios entram como colunas
nullable na mesma linha.

- Avaliações gravadas antes da v4 seguem válidas (têm `nota`, critérios nulos).
- A avaliação que o **trabalhador** faz da empresa continua com nota única — a
  especificação pede critérios apenas para a empresa avaliando o trabalhador.
- A regra vive em `lib/domain/avaliacao.ts` (puro): exige pelo menos um critério,
  valida 1..5 apontando o critério pelo nome, e deriva a nota geral. O banco também
  garante a faixa (CHECK `avaliacoes_notas_1_a_5`).

## Consequências

**Positivas**

- Reputação e escalação inteligente **não foram tocadas** e continuam corretas,
  inclusive misturando avaliações antigas e novas.
- Uma linha por avaliação mantém a consulta simples (sem `GROUP BY` por critério) e
  o `@@unique(evento, empresa, trabalhador, autor)` continua valendo.
- O resumo por critério (`resumirCriterios`) dá o "histórico do trabalhador" pedido
  no item 3 e a base para as recomendações por IA citadas como trabalho futuro.

**Negativas / limites aceitos**

- **Média arredondada perde informação**: 4,4 e 4,6 viram 4 e 5 na nota geral. A
  média exata (`mediaExata`) fica disponível para exibição, mas quem lê só `nota` vê
  o inteiro. Aceito porque nota inteira é o contrato que o resto do sistema já usava.
- **Critérios são fixos em código**, não configuráveis por empresa. Torná-los
  dinâmicos exigiria a tabela da alternativa 3 — e mudaria consulta, UI e o cálculo
  de reputação sem ganho no escopo atual.
- Adicionar um sexto critério no futuro é uma migration de coluna, não de linha.
