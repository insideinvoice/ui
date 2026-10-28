/**
 * Pure validation for the public registration form (src/Authentication/Register.jsx).
 *
 * Kept framework-free on purpose so scripts/registerValidation.test.mjs can
 * exercise it with plain node:assert (npm run test:unit) and so the rules stay
 * in lockstep with the backend RegisterRequest constraints:
 *   name 2-100, email well-formed (normalized trim+lowercase), password 8-100,
 *   confirm must match. Mirrors the server contract; the server re-validates.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;
export const NAME_MIN = 2;
export const NAME_MAX = 100;

// Deliberately pragmatic (same spirit as the backend @Email): one @, no spaces,
// domain with a dot. Full RFC 2822 is hostile to real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonical email form — matches the backend's trim + lowercase policy. */
export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * @returns {{ name?: string, email?: string, password?: string, confirmPassword?: string }}
 *          An empty object means the form is valid.
 */
export function validateRegisterForm({ name, email, password, confirmPassword }) {
  const errors = {};
  const trimmedName = (name || "").trim();

  if (!trimmedName) {
    errors.name = "Full name is required";
  } else if (trimmedName.length < NAME_MIN) {
    errors.name = `Name must be at least ${NAME_MIN} characters`;
  } else if (trimmedName.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters`;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 255) {
    errors.email = "Enter a valid email address";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters`;
  } else if (password.length > PASSWORD_MAX) {
    errors.password = `Password must be at most ${PASSWORD_MAX} characters`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}

/**
 * Maps the backend 400 `fieldErrors` map onto the form's field keys so API
 * rejections light up inline. Server keys are the DTO field names (see
 * GlobalExceptionHandler: fieldError.getField()); anything unknown is
 * ignored. The caller merges the result over local errors.
 */
export function mapApiFieldErrors(fieldErrors) {
  const mapped = {};
  if (!fieldErrors || typeof fieldErrors !== "object") return mapped;
  const allowed = new Set(["name", "email", "password", "confirmPassword"]);
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (allowed.has(field) && typeof message === "string") mapped[field] = message;
  }
  return mapped;
}
