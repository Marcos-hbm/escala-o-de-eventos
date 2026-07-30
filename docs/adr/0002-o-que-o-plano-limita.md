# ADR 0002 — O que o plano limita (e o que nunca é bloqueado)

- **Status:** aceito
- **Data:** 2026-07-30
- **Contexto da versão:** v3 (modelo SaaS)

## Contexto

Com `assinaturas` no modelo, era preciso decidir **o que** o plano restringe. A
tentação num sistema de demonstração é marcar várias funções como "pagas" para a
tela de planos ficar cheia — inclusive coisas que são requisito do TCC, como a
exportação da lista de escalados em CSV (RF11).

## Decisão

O gating tem duas naturezas, e nada além disso:

1. **Limites quantitativos de uso** (`lib/planos.ts`): usuários da conta, eventos
   ativos, vínculos ativos/pendentes.
2. **Uma feature flag real**: `escalacaoInteligente` — a ordenação por score
   (reputação + presença) e o botão "⚡ Selecionar sugeridos", que são extras de
   produtividade introduzidos na v2, não requisitos do TCC.

**Requisitos funcionais do TCC (RF01–RF15) nunca são bloqueados por plano** —
inclusive CSV da escala, notificações, presença e avaliações. O plano Starter
(grátis) executa o sistema descrito na monografia de ponta a ponta.

Regras de aplicação:

- O bloqueio por limite é verificado na server action (fonte da verdade) **e**
  antecipado na UI (botão escondido + aviso), para o usuário não descobrir o
  limite só depois de preencher um formulário.
- A mensagem de bloqueio sempre diz o teto, o plano atual e **como liberar
  espaço** — não apenas "não permitido".
- Só ações **da empresa** são barradas por cota. Um trabalhador nunca recebe erro
  por causa do plano de uma empresa (efeito colateral aceito: pedidos de vínculo
  recebidos podem levar a conta ao teto; a empresa então não convida/aceita mais
  ninguém até liberar espaço).
- **Downgrade** é recusado enquanto o uso estiver acima dos limites do plano
  destino, para a conta nunca ficar em estado inconsistente (ex.: 5 membros num
  plano de 2).
- Empresa sem linha em `assinaturas` (dado criado fora do app) é tratada como
  STARTER/TRIAL — o mais restrito, para não liberar recurso pago por omissão.

## Consequências

- A cobertura de requisitos do TCC continua íntegra e verificável sem depender de
  plano — o que era essencial para não enfraquecer o trabalho acadêmico.
- A tela de planos é modesta (uma feature paga), mas honesta: cada item listado
  existe no produto e é testado.
- O catálogo de planos é uma estrutura pura e única (`PLANOS`), então mudar preço,
  limite ou incluir uma feature nova é edição em um só lugar, coberta por testes
  unitários.
- Não há cobrança: `assinaturas.provedor`/`provedor_ref` existem como ganchos e a
  troca de plano é aplicada direto. Integrar um PSP não deve exigir mudança no
  gating, apenas preencher status/provedor.
