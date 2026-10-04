// Datos de demostración para desarrollo: `npm run seed` (también corre tras `prisma migrate reset`).
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const DEMO_PASSWORD = "Demo1234!";
const DEMO_USERS = [
  { name: "Ana Admin", email: "admin@demo.com", role: "ADMIN" },
  { name: "Sergio Supervisor", email: "supervisor@demo.com", role: "SUPERVISOR" },
  { name: "Elena Empleada", email: "empleado@demo.com", role: "EMPLOYEE" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("El seed crea cuentas con contraseña conocida: no se ejecuta con NODE_ENV=production.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: DEMO_USERS[0].email } });
  if (existing) {
    console.log("El seed ya se aplicó (admin@demo.com existe). Para empezar de cero: npx prisma migrate reset");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.organization.create({
    data: {
      name: "Constructora Demo",
      users: { create: DEMO_USERS.map((user) => ({ ...user, passwordHash })) },
      // Coordenadas de ejemplo (CDMX): crea un proyecto en tu ubicación real para probar el geofencing.
      projects: { create: { name: "Casa Reforma 245", latitude: 19.4284, longitude: -99.1677, geofenceRadius: 120 } },
    },
  });

  console.log("Seed aplicado. Organización: Constructora Demo");
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(10)} ${user.email}  /  ${DEMO_PASSWORD}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
