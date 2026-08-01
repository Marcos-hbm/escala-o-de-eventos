import { z } from "zod";
import { isValidCPF, isValidCNPJ, idade } from "./validators-doc";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const digits = (s: string) => s.replace(/\D/g, "");

const senhaSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra")
  .regex(/[0-9]/, "A senha deve conter ao menos um número");

const telefoneSchema = z
  .string()
  .transform(digits)
  .refine((v) => v.length === 10 || v.length === 11, "Telefone inválido (DDD + número)");

// --------------------------------------------------------------------------
// Cadastro — Trabalhador (RF01)
// --------------------------------------------------------------------------

export const cadastroTrabalhadorSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
    cpf: z
      .string()
      .transform(digits)
      .refine((v) => v.length === 11, "CPF deve ter 11 dígitos")
      .refine(isValidCPF, "CPF inválido"),
    dataNascimento: z.coerce.date({ errorMap: () => ({ message: "Data de nascimento inválida" }) }),
    telefone: telefoneSchema,
    genero: z.enum(["MASCULINO", "FEMININO", "OUTRO", "NAO_INFORMADO"]).default("NAO_INFORMADO"),
    senha: senhaSchema,
    aceiteLgpd: z.coerce.boolean().refine((v) => v === true, "É necessário aceitar a Política de Privacidade"),
  })
  .refine((d) => idade(d.dataNascimento) >= 16, {
    message: "É necessário ter ao menos 16 anos",
    path: ["dataNascimento"],
  });

export type CadastroTrabalhadorInput = z.infer<typeof cadastroTrabalhadorSchema>;

// --------------------------------------------------------------------------
// Cadastro — Empresa (RF02)
// --------------------------------------------------------------------------

export const cadastroEmpresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe a razão social / nome fantasia").max(160),
  cnpj: z
    .string()
    .transform(digits)
    .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos")
    .refine(isValidCNPJ, "CNPJ inválido"),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  telefone: telefoneSchema,
  senha: senhaSchema,
  aceiteLgpd: z.coerce.boolean().refine((v) => v === true, "É necessário aceitar a Política de Privacidade"),
});

export type CadastroEmpresaInput = z.infer<typeof cadastroEmpresaSchema>;

// --------------------------------------------------------------------------
// Login (RF03)
// --------------------------------------------------------------------------

export const loginSchema = z.object({
  tipo: z.enum(["TRABALHADOR", "EMPRESA"]),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --------------------------------------------------------------------------
// Perfil (RF04)
// --------------------------------------------------------------------------

export const perfilTrabalhadorSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  telefone: telefoneSchema,
  genero: z.enum(["MASCULINO", "FEMININO", "OUTRO", "NAO_INFORMADO"]),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  habilidades: z.string().trim().max(400).optional().or(z.literal("")),
});

// Avaliação bidirecional (v2)
export const avaliacaoSchema = z.object({
  nota: z.coerce.number().int().min(1, "Nota de 1 a 5").max(5, "Nota de 1 a 5"),
  comentario: z.string().trim().max(500).optional().or(z.literal("")),
});

export const perfilEmpresaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  telefone: telefoneSchema,
});

// --------------------------------------------------------------------------
// SaaS (v3) — Equipe (membros) e plano
// --------------------------------------------------------------------------

const papelSchema = z.enum(["PROPRIETARIO", "ADMIN", "COORDENADOR", "VISUALIZADOR"]);

export const membroSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do membro").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  senha: senhaSchema,
  papel: papelSchema,
});

export const alterarPapelSchema = z.object({
  membroId: z.coerce.number().int().positive(),
  papel: papelSchema,
});

export const planoSchema = z.object({
  plano: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

// --------------------------------------------------------------------------
// Evento (RF05 / RF08)
// --------------------------------------------------------------------------

export const eventoSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do evento").max(180),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  dataEvento: z.coerce.date({ errorMap: () => ({ message: "Data do evento inválida" }) }),
  local: z.string().trim().max(200).optional().or(z.literal("")),
  horaInicio: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:MM)")
    .optional()
    .or(z.literal("")),
  vagas: z.coerce.number().int().min(1, "Mínimo de 1 vaga").max(10000),
  funcoes: z.string().trim().max(400).optional().or(z.literal("")),
  valorCache: z.coerce.number().min(0, "Valor não pode ser negativo").max(1_000_000),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type EventoInput = z.infer<typeof eventoSchema>;

// --------------------------------------------------------------------------
// Financeiro (v4)
// --------------------------------------------------------------------------

const formaPagamentoSchema = z.enum(["PIX", "DINHEIRO", "CARTAO_CREDITO"]);

/** Dinheiro digitado por humano: aceita "1.234,50" e "1234.50". */
const valorMonetario = z
  .string()
  .trim()
  .min(1, "Informe o valor")
  .transform((v) => {
    const limpo = v.replace(/[^\d,.-]/g, "");
    // Se tem vírgula, ela é o separador decimal (padrão BR) e o ponto é milhar.
    const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
    return Number(normalizado);
  })
  .refine((n) => Number.isFinite(n), "Valor inválido")
  .refine((n) => n >= 0, "Valor não pode ser negativo")
  .refine((n) => n <= 1_000_000, "Valor acima do limite");

/**
 * Texto opcional vindo de `FormData`.
 *
 * `formData.get("campo")` devolve **null** quando o campo não existe no formulário
 * (não `undefined` nem `""`), e um `.optional()` cru rejeita null com "Invalid
 * input" — erro que aparece como recusa da operação sem explicar nada. O
 * `preprocess` normaliza null/"" para undefined antes de validar.
 */
const textoOpcional = (max: number, mensagem?: string) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.string().trim().max(max, mensagem).optional(),
  );

const horaOpcional = textoOpcional(5, "Use o formato HH:MM");

export const valorPagamentoSchema = z.object({
  pagamentoId: z.coerce.number().int().positive(),
  valorDevido: valorMonetario,
  funcao: textoOpcional(120),
  horaEntrada: horaOpcional,
  horaSaida: horaOpcional,
  observacoes: textoOpcional(500),
});

export const registrarPagamentoSchema = z.object({
  pagamentoId: z.coerce.number().int().positive(),
  valor: valorMonetario.refine((n) => n > 0, "Informe um valor maior que zero"),
  forma: formaPagamentoSchema,
  observacao: textoOpcional(300),
});

export const itemFechamentoSchema = z.object({
  pagamentoId: z.coerce.number().int().positive(),
  // No fechamento, zero é resposta válida: significa "não pago".
  valorPago: valorMonetario,
  forma: formaPagamentoSchema,
  observacao: textoOpcional(300),
});

export const contestacaoSchema = z.object({
  pagamentoId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3, "Descreva o motivo em poucas palavras").max(120),
  descricao: z
    .string()
    .trim()
    .min(20, "Explique o problema com pelo menos 20 caracteres para a empresa entender")
    .max(1000),
});

export const respostaContestacaoSchema = z.object({
  contestacaoId: z.coerce.number().int().positive(),
  resposta: z.string().trim().min(10, "Escreva a resposta ao trabalhador").max(1000),
  status: z.enum(["EM_ANALISE", "RESOLVIDA", "REJEITADA"]),
});

/** Avaliação por critérios (v4 item 3). Cada critério é opcional; ao menos um é exigido pelo domínio. */
const notaCriterio = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? undefined : v),
  z.coerce.number().int().min(1, "Nota de 1 a 5").max(5, "Nota de 1 a 5").optional(),
);

export const avaliacaoCriteriosSchema = z.object({
  eventoId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  pontualidade: notaCriterio,
  comunicacao: notaCriterio,
  trabalhoEquipe: notaCriterio,
  qualidade: notaCriterio,
  comprometimento: notaCriterio,
  comentario: textoOpcional(500),
});

/** Bloqueio de trabalhador (v4 item 5): o motivo é obrigatório e fica registrado. */
export const bloqueioSchema = z.object({
  userId: z.coerce.number().int().positive(),
  motivo: z
    .string()
    .trim()
    .min(10, "Descreva o motivo com pelo menos 10 caracteres — ele fica registrado e pode ser revisto")
    .max(300),
});

export const desbloqueioSchema = z.object({
  bloqueioId: z.coerce.number().int().positive(),
  motivoRemocao: textoOpcional(300),
});

export const favoritoSchema = z.object({
  userId: z.coerce.number().int().positive(),
  observacao: textoOpcional(300),
});

// --------------------------------------------------------------------------
// Comunicação do evento (v4, itens 7 e 8)
// --------------------------------------------------------------------------

export const solicitacaoEventoSchema = z.object({
  eventoId: z.coerce.number().int().positive(),
  tipo: z.enum(["INTERVALO", "DESCANSO", "PROBLEMA", "AJUDA", "SUBSTITUICAO", "FALAR_COORDENACAO"]),
  mensagem: textoOpcional(500),
});

export const respostaSolicitacaoSchema = z.object({
  solicitacaoId: z.coerce.number().int().positive(),
  status: z.enum(["EM_ANALISE", "AGUARDANDO", "APROVADA", "RECUSADA", "FINALIZADA"]),
  resposta: textoOpcional(500),
});

export const mensagemCoordenacaoSchema = z.object({
  eventoId: z.coerce.number().int().positive(),
  texto: z.string().trim().min(2, "Escreva a mensagem").max(500),
  /** Vazio = recado para toda a equipe escalada. */
  userId: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
});

/** Chave PIX do trabalhador (o valor é validado por tipo em `lib/pix.ts`). */
export const chavePixSchema = z.object({
  tipo: z.enum(["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]),
  chave: z.string().trim().min(1, "Informe a chave PIX").max(140),
});

// --------------------------------------------------------------------------
// Escalação (RF10)
// --------------------------------------------------------------------------

export const escalarSchema = z.object({
  eventoId: z.coerce.number().int().positive(),
  userIds: z.array(z.coerce.number().int().positive()).min(1, "Selecione ao menos um trabalhador"),
});
