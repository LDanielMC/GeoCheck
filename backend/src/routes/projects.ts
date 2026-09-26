import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  geofenceRadius: z.number().min(20).max(1000).default(120),
  budgetHours: z.number().optional(),
});

router.post("/", async (req, res) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({ data: body });
    res.status(201).json(project);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  const { organizationId } = req.query;
  const projects = await prisma.project.findMany({
    where: { organizationId: String(organizationId), archived: false },
  });
  res.json(projects);
});

export default router;
