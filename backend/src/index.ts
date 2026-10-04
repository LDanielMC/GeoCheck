import { createApp } from "./app";
import { getConfig, type Config } from "./config";
import { prisma } from "./db";

async function main() {
  // Falla rápido y con un mensaje claro si falta algo (en vez de romperse en el primer login).
  let config: Config;
  try {
    config = getConfig();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  try {
    await prisma.$connect();
  } catch {
    console.error(
      "No se pudo conectar a la base de datos. Revisa DATABASE_URL en .env y que Postgres esté arriba (docker compose up -d)."
    );
    process.exit(1);
  }

  const server = createApp().listen(config.PORT, () => {
    console.log(`Backend corriendo en http://localhost:${config.PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
