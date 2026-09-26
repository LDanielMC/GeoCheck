import { Router } from "express";
import { z } from "zod";
import { clockIn, clockOut, delegatedClockIn, editTimeEntry } from "../services/timeEntryService";

const router = Router();

const clockInSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  lat: z.number(),
  lon: z.number(),
  type: z.enum(["AUTO", "MANUAL", "DELEGATED"]).optional(),
});

router.post("/clock-in", async (req, res) => {
  try {
    const body = clockInSchema.parse(req.body);
    const entry = await clockIn(body);
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/clock-out", async (req, res) => {
  try {
    const entry = await clockOut({ timeEntryId: req.params.id });
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/delegated-clock-in", async (req, res) => {
  try {
    const { supervisorId, targetUserId, projectId } = req.body;
    const entry = await delegatedClockIn({ supervisorId, targetUserId, projectId });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { editorId, clockIn: ci, clockOut: co } = req.body;
    const entry = await editTimeEntry({
      timeEntryId: req.params.id,
      editorId,
      clockIn: ci ? new Date(ci) : undefined,
      clockOut: co ? new Date(co) : undefined,
    });
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
