# ADR 0007 — Comunicação do evento: janela de funcionamento e "tempo real" por polling

- **Status:** aceito
- **Data:** 2026-08-01
- **Contexto da versão:** v4, fase 5

## Contexto

O item 7 da especificação pede um módulo de comunicação "disponível somente enquanto
o evento estiver em andamento", com o coordenador recebendo os pedidos "em tempo
real" e o trabalhador acompanhando "em tempo real".

Duas decisões precisavam de definição explícita: **o que é "em andamento"** e **o que
é "tempo real"** num app Next.js sem infraestrutura de mensageria.

## Decisão

### 1. Janela: o dia do evento, no fuso de Brasília

`estadoDoEvento(dataEvento, status, agora)` (`lib/domain/comunicacao.ts`, puro)
devolve `FUTURO | EM_ANDAMENTO | ENCERRADO`. Em andamento = a **data civil do
evento** é igual ao **dia civil de hoje em Brasília** e o evento não está finalizado
nem cancelado.

Comparação é data civil × data civil de propósito: `Evento.dataEvento` é `@db.Date`
(dia sem hora). A primeira versão usou o formatador de data civil (UTC) para descobrir
"hoje" e dava `ENCERRADO` para o evento do próprio dia entre 21h e meia-noite — bug
pego por teste unitário antes de chegar à tela. Daí nasceu `diaCivilBR()`.

Fora da janela, **a leitura continua**: o histórico de solicitações, respostas e
mensagens fica acessível (a especificação pede que toda a comunicação fique
registrada no histórico do evento). O que fecha são as **ações**.

### 2. "Tempo real" = polling isolado em um componente

`components/atualizacao-automatica.tsx` atualiza a tela a cada 15 s, é pausável e
traz um link "atualizar agora" que é navegação real.

Motivos (a alternativa SSE/WebSocket foi avaliada no início da v4):

- **Sem infraestrutura nova**: funciona em qualquer deploy, inclusive serverless,
  onde conexão longa é cortada;
- **determinístico no teste**: o E2E verifica o intervalo declarado (`data-intervalo`)
  e o link de atualizar, sem depender de timer;
- **resiliente**: o link é navegação de verdade, então funciona mesmo quando o
  refresh do router não é aplicado (ADR 0004);
- **trocável**: toda a lógica de atualização está em um arquivo — migrar para SSE ou
  um provedor (Pusher/Ably) não toca nas telas.

### 3. Transições de status são domínio

`EM_ANALISE → aprovada | recusada | aguardando`; `AGUARDANDO → aprovada | recusada |
finalizada`; `APROVADA → finalizada`. **Recusada** e **finalizada** são terminais: o
trabalhador abre uma nova solicitação em vez de reabrir a antiga, o que manteria o
histórico coerente com o que aconteceu.

Também: **um pedido aberto por tipo** por trabalhador/evento — repetir o mesmo pedido
antes da resposta só polui a fila do coordenador. A recusa vale nas duas camadas (a
tela desabilita a opção; o servidor recusa com motivo se a tela for burlada).

## Consequências

**Positivas**

- A janela e as transições estão em funções puras com teste exaustivo — não em
  condicional de tela.
- Latência de até 15 s para o coordenador ver um pedido novo, sem nenhum serviço
  extra; a notificação in-app chega junto.
- Fila ordenada (abertas antes, urgentes na frente, mais antigas primeiro) dá ao
  coordenador uma ordem de atendimento previsível.

**Negativas / limites aceitos**

- **Não é push**: 15 s de atraso é aceitável para intervalo e ajuda, mas não seria
  para um alarme de emergência. Se o produto precisar disso, o caminho é SSE no mesmo
  componente.
- **Polling custa requisições**: com muitos coordenadores na mesma tela, são N
  requisições a cada 15 s. Mitigado por ser pausável e restrito ao painel e à tela do
  trabalhador.
- **Janela de um dia** não cobre evento que atravessa a madrugada além do dia civil
  (ex.: das 22h às 6h do dia seguinte): no dia seguinte o canal fecha. Resolver exige
  hora de fim no evento — hoje `horaInicio` é livre e não há `horaFim`.
