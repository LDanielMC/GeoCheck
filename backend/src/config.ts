import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// .env.example trae un secreto de desarrollo con esta marca; en producción se rechaza.
const DEV_SECRET_MARKER = "dev-only";

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string({ required_error: "es obligatoria" }).min(1, "es obligatoria"),
    JWT_SECRET: z
      .string({ required_error: "es obligatorio" })
      .min(32, "debe tener al menos 32 caracteres"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    // Número de proxies delante del servidor (0 = ninguno). Necesario para que el rate limit vea la IP real.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    // Intentos fallidos por minuto y por IP en registro, login y unirse con código.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  })
  .refine((env) => !(env.NODE_ENV === "production" && env.JWT_SECRET.includes(DEV_SECRET_MARKER)), {
    path: ["JWT_SECRET"],
    message: "es el valor de desarrollo de .env.example; genera uno real para producción",
  });

export type Config = z.infer<typeof envSchema>;

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración inválida:\n${problems}`);
  }
  return result.data;
}

let cached: Config | undefined;

// Se evalúa al primer uso (no al importar) para que index.ts pueda mostrar un error claro y salir.
export function getConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
