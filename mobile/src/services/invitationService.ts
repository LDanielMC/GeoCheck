import { api } from "./api";
import type { Invitation, InvitableRole } from "../types";

export async function createInvitation(input: { role: InvitableRole; expiresInDays: number }): Promise<Invitation> {
  const { data } = await api.post<Invitation>("/invitations", input);
  return data;
}

export async function listInvitations(): Promise<Invitation[]> {
  const { data } = await api.get<Invitation[]>("/invitations");
  return data;
}

export async function revokeInvitation(id: string): Promise<Invitation> {
  const { data } = await api.delete<Invitation>(`/invitations/${id}`);
  return data;
}
