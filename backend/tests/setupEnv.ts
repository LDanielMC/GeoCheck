import { inject } from "vitest";

// Corre en cada worker antes de los tests: apunta Prisma y la config a la base de pruebas.
const url = inject("testDatabaseUrl");
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
