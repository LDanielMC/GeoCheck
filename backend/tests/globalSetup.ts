import { execSync } from "node:child_process";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import type { TestProject } from "vitest/node";
import { resolveTestDatabaseUrl } from "./testDb";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

// Se ejecuta una vez antes de todos los tests: crea la base de pruebas si no existe,
// aplica las migraciones, la deja vacía y comparte su URL con los workers.
export default async function setup(project: TestProject) {
  dotenv.config();
  const testUrl = resolveTestDatabaseUrl(process.env);
  project.provide("testDatabaseUrl", testUrl);
  const dbName = new URL(testUrl).pathname.slice(1); // ya validado: solo [A-Za-z0-9_] y termina en _test

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"`;
    if (!rows[0].exists) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  try {
    execSync("npx prisma migrate deploy", {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    });
  } catch (err) {
    const out = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`prisma migrate deploy falló en ${dbName}:\n${out.stdout}\n${out.stderr}`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "TimeEntry", "Invitation", "User", "Project", "Organization" RESTART IDENTITY CASCADE'
    );
  } finally {
    await prisma.$disconnect();
  }
}
