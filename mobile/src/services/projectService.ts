import { api } from "./api";
import type { ProjectInput } from "../projects/rules";
import type { Project } from "../types";

// includeArchived solo lo acepta el servidor para el ADMIN (los demás roles reciben 403).
export async function listProjects(options: { includeArchived?: boolean } = {}): Promise<Project[]> {
  const { data } = await api.get<Project[]>("/projects", { params: options.includeArchived ? { includeArchived: "true" } : undefined });
  return data;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { data } = await api.post<Project>("/projects", input);
  return data;
}

export async function updateProject(id: string, patch: Partial<ProjectInput> & { archived?: boolean }): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}`, patch);
  return data;
}
