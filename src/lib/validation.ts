// src/lib/validation.ts — Input validation utilities

import { CONFIG } from "./config";

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const { passwordRequirements } = CONFIG.auth;

  if (password.length < passwordRequirements.minLength) {
    errors.push(
      `Password must be at least ${passwordRequirements.minLength} characters`
    );
  }

  if (password.length > CONFIG.auth.maxPasswordLength) {
    errors.push(
      `Password must be at most ${CONFIG.auth.maxPasswordLength} characters`
    );
  }

  if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (passwordRequirements.requireNumber && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (
    passwordRequirements.requireSpecial &&
    !/[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    errors.push("Password must contain at least one special character");
  }

  return { valid: errors.length === 0, errors };
}

export function validateUsername(username: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (username.length < CONFIG.limits.minUsernameLength) {
    errors.push(
      `Username must be at least ${CONFIG.limits.minUsernameLength} characters`
    );
  }

  if (username.length > CONFIG.limits.maxUsernameLength) {
    errors.push(
      `Username must be at most ${CONFIG.limits.maxUsernameLength} characters`
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push(
      "Username can only contain letters, numbers, underscores, and hyphens"
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateWeight(weight: number | null | undefined): boolean {
  if (weight === null || weight === undefined) return true;
  return typeof weight === "number" && weight >= 0 && weight <= 2000;
}

export function validateReps(reps: number | null | undefined): boolean {
  if (reps === null || reps === undefined) return true;
  return (
    typeof reps === "number" &&
    Number.isInteger(reps) &&
    reps >= 0 &&
    reps <= 1000
  );
}

export function validateHoldTime(holdTime: number | null | undefined): boolean {
  if (holdTime === null || holdTime === undefined) return true;
  return typeof holdTime === "number" && holdTime >= 0 && holdTime <= 3600;
}
