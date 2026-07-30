/**
 * Gerenciador de um PostgreSQL local para desenvolvimento SEM Docker.
 * Usa os binários oficiais trazidos por `embedded-postgres` e inicia o servidor
 * via `pg_ctl` (daemon real, que sobrevive à saída deste processo). A criação do
 * banco é feita pelo driver `pg` (os binários bundled não incluem `createdb`).
 *
 *   node scripts/db.mjs up      # inicializa (1ª vez) e sobe o Postgres
 *   node scripts/db.mjs down    # para o Postgres
 *   node scripts/db.mjs status  # verifica se está no ar
 *
 * Alternativa recomendada em produção/máquina do dev: Docker (docker-compose.yml).
 */
import EmbeddedPostgres from "embedded-postgres";
import pgPkg from "pg";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const { Client } = pgPkg;
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".pgdata");
const BIN = path.join(ROOT, "node_modules", "@embedded-postgres", "linux-x64", "native", "bin");
const PG_CTL = path.join(BIN, "pg_ctl");
const PORT = 5432;
const USER = "escala";
const PASS = "escala";
const DB = "escala";

const isInit = () => existsSync(path.join(DATA_DIR, "PG_VERSION"));
const isUp = () => spawnSync(PG_CTL, ["-D", DATA_DIR, "status"]).status === 0;

async function init() {
  if (isInit()) return;
  console.log("Inicializando cluster em .pgdata ...");
  const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: USER, password: PASS, port: PORT, persistent: true });
  await pg.initialise();
  console.log("Cluster inicializado (superusuário: escala).");
}

function startDaemon() {
  const log = path.join(DATA_DIR, "server.log");
  const r = spawnSync(PG_CTL, ["-D", DATA_DIR, "-l", log, "-o", `-p ${PORT}`, "-w", "start"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("Falha ao iniciar o PostgreSQL. Veja", log);
    process.exit(1);
  }
}

async function ensureDatabase() {
  const client = new Client({ host: "localhost", port: PORT, user: USER, password: PASS, database: "postgres" });
  await client.connect();
  const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB]);
  if (r.rowCount === 0) {
    await client.query(`CREATE DATABASE "${DB}"`);
    console.log(`Banco '${DB}' criado.`);
  }
  await client.end();
}

const cmd = process.argv[2];

if (cmd === "up") {
  await init();
  if (isUp()) {
    console.log("PostgreSQL já está no ar em localhost:5432.");
  } else {
    startDaemon();
  }
  await ensureDatabase();
  console.log(`PostgreSQL pronto em postgresql://${USER}:***@localhost:${PORT}/${DB}`);
} else if (cmd === "down") {
  if (isInit() && isUp()) {
    spawnSync(PG_CTL, ["-D", DATA_DIR, "-m", "fast", "-w", "stop"], { stdio: "inherit" });
    console.log("PostgreSQL parado.");
  } else {
    console.log("PostgreSQL não está no ar.");
  }
} else if (cmd === "status") {
  console.log(isInit() && isUp() ? "no ar (localhost:5432)" : "parado");
} else {
  console.log("Comandos: up | down | status");
  process.exit(1);
}
