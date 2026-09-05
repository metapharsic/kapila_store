import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 10;

export function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw Object.assign(new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`), { status: 400 });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw Object.assign(new Error("Password must include at least one letter and one number."), { status: 400 });
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
