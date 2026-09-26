import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import timeEntriesRouter from "./routes/timeEntries";
import projectsRouter from "./routes/projects";
import authRouter from "./routes/auth";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/time-entries", timeEntriesRouter);
app.use("/projects", projectsRouter);
app.use("/auth", authRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
