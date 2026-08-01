# Casos de uso

Atores: **Trabalhador** (freelancer), **Empresa** (conta/tenant) e, dentro da
empresa, os papéis **Proprietário (P)**, **Administrador (A)**, **Coordenador (C)** e
**Visualizador (V)**. `C-fin` = Coordenador com acesso financeiro autorizado.

Os casos UC-01…UC-15 vêm dos requisitos do TCC (RF01–RF15); UC-16 em diante são das
versões v2–v4. A matriz de teste correspondente está em
[`CASOS_DE_TESTE.md`](CASOS_DE_TESTE.md).

---

## Cadastro, acesso e perfil

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-01 | Cadastrar-se como trabalhador | Trabalhador | informa dados pessoais e aceita a política | CPF válido, ≥16 anos, consentimento LGPD registrado |
| UC-02 | Cadastrar empresa | Empresa | informa CNPJ e dados de contato | conta nasce com membro Proprietário e assinatura STARTER em trial de 14 dias |
| UC-03 | Autenticar | ambos | escolhe tipo de conta, e-mail e senha | empresa autentica **por membro**; conta anonimizada não entra; acesso revogado cai no próximo request |
| UC-04 | Manter perfil | ambos | edita dados e foto | empresa exige `empresa:editar` (P, A) |
| UC-16 | Cadastrar chave PIX | Trabalhador | escolhe tipo e informa a chave | chave normalizada por tipo e guardada **cifrada**; exibida mascarada ao próprio titular |
| UC-17 | Exercer direitos LGPD | ambos | exporta dados (JSON) ou exclui a conta | exclusão anonimiza; em empresa, desativa toda a equipe e cancela a assinatura; só P exclui a conta |

## Vínculos e oportunidades

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-05 | Convidar trabalhador | P, A, C | busca por nome e envia convite | consome cota de vínculos do plano; bloqueado não aparece na busca |
| UC-06 | Solicitar vínculo | Trabalhador | busca empresa e solicita | um vínculo por par; recusado/desfeito pode ser reaberto |
| UC-07 | Responder vínculo | contraparte | aceita ou recusa | só a contraparte de quem solicitou responde; notifica o trabalhador |
| UC-08 | Descobrir vagas | Trabalhador | lista eventos das empresas vinculadas | **RF13**: exige vínculo ATIVO; empresa que bloqueou não aparece |
| UC-09 | Candidatar-se / desistir | Trabalhador | inscreve-se ou cancela | recusa candidatura de bloqueado, inclusive por chamada direta à action |

## Eventos e escala

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-10 | Publicar evento | P, A, C | preenche data, local, vagas, funções e cachê | cota de eventos ativos do plano; notifica vinculados |
| UC-11 | Editar / excluir evento | P, A (excluir), + C (editar) | ajusta dados ou remove | evento finalizado não é editável; exclusão pede **confirmação em duas etapas** |
| UC-12 | Escalar e finalizar | P, A, C | seleciona inscritos e finaliza | transação: escalados → ESCALADO, demais → RECUSADO_EMPRESA, evento → FINALIZADO |
| UC-13 | Exportar lista da escala | qualquer membro | baixa CSV | padrão BR (`;`, BOM, `DD/MM/AAAA`, vírgula decimal); 404 para evento de outra empresa |
| UC-14 | Consultar histórico | Trabalhador | vê participações e situação | inclui indicador de pagamento (✅/⏳) |
| UC-15 | Acompanhar notificações | Trabalhador | lê e marca como lidas | badge de não lidas no menu; paginação |
| UC-18 | Escalação inteligente | P, A, C | ordena candidatos por desempenho e usa sugestão | recurso do plano Professional; sem ele, ordem alfabética |

## Equipe e plano (SaaS)

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-19 | Gerenciar equipe | P, A | adiciona membro, troca papel, revoga acesso | cota de usuários do plano; só P atribui/retira Proprietário; conta nunca fica sem Proprietário ativo; ninguém se desativa |
| UC-20 | Autorizar acesso financeiro | P, A | marca `acesso financeiro` para um Coordenador | Visualizador nunca recebe acesso financeiro |
| UC-21 | Consultar e trocar plano | todos veem; P troca | compara planos e migra | downgrade recusado se o uso exceder o plano destino |

## Fluxo pós-evento (financeiro)

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-22 | Abrir "Finalizar pagamentos" | P, A, C-fin | abre a tela do evento finalizado | linhas criadas automaticamente a partir do cachê; acesso exige `financeiro:ver` |
| UC-23 | Ajustar o combinado | P, A, C-fin | corrige valor, função, horário e observações | valor devido não pode ficar abaixo do já pago |
| UC-24 | Registrar pagamento (total/parcial) | P, A, C-fin | informa valor e forma | não excede o saldo; gera lançamento no histórico; notifica o trabalhador |
| UC-25 | Estornar pagamento | P, A, C-fin | marca como pendente | **preserva** os lançamentos; estorno vai para a auditoria |
| UC-26 | Ver e copiar chave PIX | P, A, C-fin (`pix:ver`) | abre a chave do trabalhador escalado | decifra só nesse caminho; **cada visualização é auditada** |
| UC-27 | Conduzir fechamento de caixa | P, A, C-fin | inicia, confere cada trabalhador (pago/parcial/não pago) e conclui | iniciar notifica todos os escalados; conclusão exige todos conferidos; pendências ficam para a empresa |
| UC-28 | Contestar pagamento | Trabalhador | descreve o problema | uma contestação em aberto por pagamento; notifica responsáveis do financeiro |
| UC-29 | Responder contestação | P, A, C-fin | responde e classifica | RESOLVIDA / EM_ANALISE / REJEITADA; notifica o trabalhador |
| UC-30 | Consultar histórico financeiro | empresa (`financeiro:ver`) e Trabalhador | filtra por situação e busca por nome/evento | resumo (devido, pago, pendente) sobre o conjunto, não só a página |

## Relacionamento e reputação

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-31 | Avaliar trabalhador por critérios | P, A, C | dá nota de 1 a 5 em cinco critérios + comentário | nota geral = média arredondada; alimenta reputação e escalação; notifica o trabalhador |
| UC-32 | Avaliar empresa | Trabalhador | nota única + comentário | apenas em evento finalizado em que participou |
| UC-33 | Favoritar trabalhador | P, A, C | alterna favorito | lista própria com destaque e ponto a melhorar por critério |
| UC-34 | Bloquear trabalhador | P, A, C | informa motivo (≥10 caracteres) | desfaz vínculo, cancela inscrições futuras, remove favorito; bloqueado não vê vagas nem se candidata |
| UC-35 | Remover bloqueio | P, A | remove informando motivo | **Coordenador não remove**; a linha antiga permanece como histórico |

## Comunicação durante o evento

| UC | Caso de uso | Ator | Fluxo principal | Regras |
| --- | --- | --- | --- | --- |
| UC-36 | Pedir algo à coordenação | Trabalhador escalado | escolhe o tipo (intervalo, descanso, problema, ajuda, substituição, falar) e detalha | canal só no **dia** do evento; um pedido aberto por tipo; coordenação é notificada |
| UC-37 | Acompanhar o pedido | Trabalhador | vê status e resposta | atualização periódica (15 s) + link de atualizar |
| UC-38 | Responder solicitação | P, A, C | aprova, recusa, pede para aguardar ou finaliza | transições válidas apenas; recusada e finalizada são terminais |
| UC-39 | Enviar recado | P, A, C | escreve para a equipe ou para um trabalhador | notifica os destinatários; fica no histórico do evento |
| UC-40 | Registrar check-in / check-out | P, A, C | marca entrada e saída | check-in confirma presença e grava o horário real; check-out exige check-in |
| UC-41 | Conduzir o evento pelo painel | P, A, C | acompanha equipe, presença e fila de pedidos | fila ordenada: abertas antes, urgentes na frente, mais antigas primeiro; histórico acessível depois do evento (sem ações) |

---

## Fora de escopo (declarado)

Itens citados na especificação como futuros ou que dependem de decisão externa, e que
**não** estão implementados:

- **PDF e e-mail**: o sistema não gera PDF nem envia e-mail. A exportação é CSV e os
  avisos são notificações in-app.
- **Anexar comprovante** na contestação de pagamento (a especificação diz
  "futuramente").
- **Sugerir favoritos primeiro na escala** (a especificação diz "no futuro"): a lista
  de favoritos existe, a ordenação preferencial não.
- **Cobrança real**: a troca de plano não passa por provedor de pagamento; a
  assinatura guarda os ganchos `provedor`/`provedorRef` sem uso.
- **Recomendação por IA** a partir das avaliações: os dados por critério existem e são
  agregados, mas não há modelo consumindo isso.
