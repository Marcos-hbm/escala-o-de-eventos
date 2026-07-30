/**
 * Seed de dados de exemplo para desenvolvimento e demonstração.
 * Senha de todas as contas de exemplo: "Senha@123"
 *
 * Uso: npm run db:seed
 */
import { PrismaClient, Genero, StatusVinculo, SolicitadoPor, StatusEvento, StatusInscricao, Papel, Plano, StatusAssinatura } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Semeando banco...");

  const senhaHash = await bcrypt.hash("Senha@123", 10);

  // Limpeza (ordem respeita FKs).
  await prisma.avaliacao.deleteMany();
  await prisma.notificacao.deleteMany();
  await prisma.inscricao.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.vinculo.deleteMany();
  await prisma.consentimento.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.assinatura.deleteMany();
  await prisma.user.deleteMany();
  await prisma.empresa.deleteMany();

  // ---- Empresas ----
  const produtora = await prisma.empresa.create({
    data: {
      nome: "Produtora Cena Viva",
      cnpj: "12345678000199",
      email: "contato@cenaviva.com.br",
      telefone: "61999990001",
      senhaHash,
    },
  });

  const feiras = await prisma.empresa.create({
    data: {
      nome: "BSB Feiras & Eventos",
      cnpj: "98765432000155",
      email: "rh@bsbfeiras.com.br",
      telefone: "61999990002",
      senhaHash,
    },
  });

  // SaaS: cada empresa recebe um Membro PROPRIETARIO (login por credencial) e
  // uma Assinatura. A produtora vai de PROFESSIONAL (para demonstrar limites
  // maiores + funcionalidades premium); a de feiras fica no STARTER.
  await prisma.membro.createMany({
    data: [
      { empresaId: produtora.id, nome: "Admin Cena Viva", email: produtora.email, senhaHash, papel: Papel.PROPRIETARIO },
      { empresaId: feiras.id, nome: "Admin BSB Feiras", email: feiras.email, senhaHash, papel: Papel.PROPRIETARIO },
    ],
  });
  // Mais membros na produtora para demonstrar o RBAC na tela de Equipe.
  await prisma.membro.createMany({
    data: [
      { empresaId: produtora.id, nome: "Coord. Operações", email: "coord@cenaviva.com.br", senhaHash, papel: Papel.COORDENADOR },
      { empresaId: produtora.id, nome: "Financeiro (leitura)", email: "financeiro@cenaviva.com.br", senhaHash, papel: Papel.VISUALIZADOR },
    ],
  });
  const trialTerminaEm = new Date();
  trialTerminaEm.setDate(trialTerminaEm.getDate() + 14);
  await prisma.assinatura.createMany({
    data: [
      { empresaId: produtora.id, plano: Plano.PROFESSIONAL, status: StatusAssinatura.ATIVA },
      { empresaId: feiras.id, plano: Plano.STARTER, status: StatusAssinatura.TRIAL, trialTerminaEm },
    ],
  });

  // ---- Trabalhadores ----
  const ana = await prisma.user.create({
    data: {
      nome: "Ana Souza",
      email: "ana@exemplo.com",
      cpf: "11122233344",
      dataNascimento: new Date("1998-05-12"),
      telefone: "61988880001",
      genero: Genero.FEMININO,
      cidade: "Brasília/DF",
      habilidades: "Garçom, Bar, Atendimento",
      bio: "3 anos em eventos culturais. Disponível fins de semana.",
      senhaHash,
    },
  });

  const bruno = await prisma.user.create({
    data: {
      nome: "Bruno Lima",
      email: "bruno@exemplo.com",
      cpf: "22233344455",
      dataNascimento: new Date("1995-11-03"),
      telefone: "61988880002",
      genero: Genero.MASCULINO,
      cidade: "Brasília/DF",
      habilidades: "Segurança, Apoio de produção",
      senhaHash,
    },
  });

  const carla = await prisma.user.create({
    data: {
      nome: "Carla Dias",
      email: "carla@exemplo.com",
      cpf: "33344455566",
      dataNascimento: new Date("2000-01-20"),
      telefone: "61988880003",
      genero: Genero.FEMININO,
      senhaHash,
    },
  });

  // ---- Vínculos ----
  await prisma.vinculo.createMany({
    data: [
      { userId: ana.id, empresaId: produtora.id, status: StatusVinculo.ATIVO, solicitadoPor: SolicitadoPor.EMPRESA, favorito: true },
      { userId: bruno.id, empresaId: produtora.id, status: StatusVinculo.ATIVO, solicitadoPor: SolicitadoPor.TRABALHADOR },
      { userId: carla.id, empresaId: produtora.id, status: StatusVinculo.PENDENTE, solicitadoPor: SolicitadoPor.TRABALHADOR },
      { userId: ana.id, empresaId: feiras.id, status: StatusVinculo.ATIVO, solicitadoPor: SolicitadoPor.EMPRESA },
    ],
  });

  // ---- Eventos ----
  const festival = await prisma.evento.create({
    data: {
      empresaId: produtora.id,
      nome: "Festival de Inverno 2026",
      descricao: "Grande festival ao ar livre com três palcos.",
      dataEvento: new Date("2026-08-15"),
      local: "Parque da Cidade, Brasília/DF",
      horaInicio: "16:00",
      vagas: 20,
      funcoes: "Garçom, Bilheteiro, Segurança, Apoio de produção",
      valorCache: 180.0,
      observacoes: "Levar documento com foto. Uniforme fornecido no local.",
      status: StatusEvento.PUBLICADO,
    },
  });

  const congresso = await prisma.evento.create({
    data: {
      empresaId: feiras.id,
      nome: "Congresso de Tecnologia BSB",
      descricao: "Evento corporativo de 2 dias.",
      dataEvento: new Date("2026-09-10"),
      local: "Centro de Convenções Ulysses Guimarães",
      horaInicio: "08:00",
      vagas: 10,
      funcoes: "Recepcionista, Apoio, Credenciamento",
      valorCache: 220.0,
      status: StatusEvento.PUBLICADO,
    },
  });

  // ---- Inscrições ----
  await prisma.inscricao.createMany({
    data: [
      { eventoId: festival.id, userId: ana.id, status: StatusInscricao.INSCRITO },
      { eventoId: festival.id, userId: bruno.id, status: StatusInscricao.INSCRITO },
      { eventoId: congresso.id, userId: ana.id, status: StatusInscricao.INSCRITO },
    ],
  });

  // ---- Evento passado finalizado (alimenta painéis, reputação e presença) ----
  const feiraPassada = await prisma.evento.create({
    data: {
      empresaId: produtora.id,
      nome: "Feira Gastronômica (edição passada)",
      dataEvento: new Date("2026-05-10"),
      local: "Setor de Clubes, Brasília/DF",
      vagas: 2,
      funcoes: "Garçom, Segurança",
      valorCache: 150.0,
      status: StatusEvento.FINALIZADO,
    },
  });
  await prisma.inscricao.createMany({
    data: [
      { eventoId: feiraPassada.id, userId: ana.id, status: StatusInscricao.PRESENTE },
      { eventoId: feiraPassada.id, userId: bruno.id, status: StatusInscricao.PRESENTE },
    ],
  });
  await prisma.avaliacao.createMany({
    data: [
      // Empresa avalia os trabalhadores
      { eventoId: feiraPassada.id, empresaId: produtora.id, userId: ana.id, autor: "EMPRESA", nota: 5, comentario: "Excelente, pontual." },
      { eventoId: feiraPassada.id, empresaId: produtora.id, userId: bruno.id, autor: "EMPRESA", nota: 4 },
      // Trabalhador avalia a empresa
      { eventoId: feiraPassada.id, empresaId: produtora.id, userId: ana.id, autor: "TRABALHADOR", nota: 5, comentario: "Organização ótima." },
    ],
  });

  console.log("✅ Seed concluído.");
  console.log("   Empresas (membro PROPRIETARIO): contato@cenaviva.com.br | rh@bsbfeiras.com.br");
  console.log("   Equipe da Cena Viva (RBAC): coord@cenaviva.com.br (Coordenador) | financeiro@cenaviva.com.br (Visualizador)");
  console.log("   Planos: Cena Viva = PROFESSIONAL/ATIVA · BSB Feiras = STARTER/TRIAL");
  console.log("   Trabalhadores: ana@exemplo.com | bruno@exemplo.com | carla@exemplo.com");
  console.log("   Senha (todos): Senha@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
