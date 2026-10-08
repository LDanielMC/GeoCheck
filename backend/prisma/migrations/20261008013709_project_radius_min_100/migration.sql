-- Radio mínimo de 100 m (docs/spike-resultado.md): con un fix de ±100 m un radio de 100 m ya produjo un falso
-- positivo en las pruebas de campo. La regla vive en la API; esto solo sube lo que ya existiera por debajo
-- (datos de desarrollo) para que no quede ningún proyecto fuera de la regla.
UPDATE "Project" SET "geofenceRadius" = 100 WHERE "geofenceRadius" < 100;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "geofenceRadius" SET DEFAULT 150;
