import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { generatePassword as generatePasswordClient } from "@/lib/auth/generate-password-client";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Server-side password generation (uses Node crypto). */
export function generatePassword(length = 16): string {
  const PASSWORD_CHARS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[bytes[i]! % PASSWORD_CHARS.length];
  }
  return result;
}

export { generatePasswordClient };
