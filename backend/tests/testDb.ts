// Decide a qué base de datos apuntan los tests. Regla de seguridad: siempre una base cuyo nombre
// termine en "_test", para no truncar nunca la base de desarrollo (ni una remota como Supabase).

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.TEST_DATABASE_URL;
  const base = explicit ?? env.DATABASE_URL;
  if (!base) {
    throw new Error("Define DATABASE_URL (o TEST_DATABASE_URL) en backend/.env para correr los tests.");
  }

  const url = new URL(base);

  if (!explicit) {
    // Sin TEST_DATABASE_URL solo derivamos la base de pruebas si el servidor es local.
    if (!LOCAL_HOSTS.has(url.hostname)) {
      throw new Error(
        `DATABASE_URL apunta a ${url.hostname}, que no es local. Define TEST_DATABASE_URL con una base cuyo nombre termine en _test.`
      );
    }
    const name = url.pathname.slice(1);
    url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  }

  const dbName = url.pathname.slice(1);
  if (!/^[A-Za-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Por seguridad la base de pruebas debe terminar en _test (recibí "${dbName}").`);
  }

  // Varios archivos de test en paralelo, cada uno con su PrismaClient: limitamos el pool de cada uno.
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
  return url.toString();
}
