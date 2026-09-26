import { Router } from "express";
import { z } from "zod";
import { login } from "../services/authService";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
