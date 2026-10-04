import { randomInt } from "node:crypto";

// Sin I, L, O, 0 ni 1: son fáciles de confundir al dictar el código por teléfono o leerlo en pantalla.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)]; // randomInt es uniforme (sin sesgo de módulo)
  }
  return code;
}

// Acepta lo que escribe una persona: minúsculas, espacios o guiones ("abcd-efgh").
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
