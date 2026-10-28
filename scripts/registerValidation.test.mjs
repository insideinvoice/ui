/**
 * Registration form validation contract tests — plain node:assert, same
 * convention as the other scripts/*.test.mjs suites: npm run test:unit
 *
 * Mirrors the backend RegisterRequest rules:
 *   name 2-100, email well-formed + normalized (trim/lowercase), password
 *   8-100, confirm must match. Plus the 400 fieldErrors mapper.
 */
import assert from "node:assert/strict";
import {
  validateRegisterForm,
  normalizeEmail,
  mapApiFieldErrors,
} from "../src/Authentication/registerValidation.js";

const valid = {
  name: "Fahad Pasha",
  email: "fahad@example.com",
  password: "Str0ngPass!x",
  confirmPassword: "Str0ngPass!x",
};

// ---- valid submission ------------------------------------------------------
{
  const errors = validateRegisterForm(valid);
  assert.deepEqual(errors, {}, "valid form must produce no errors");
}

// ---- required fields -------------------------------------------------------
{
  const errors = validateRegisterForm({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  assert.equal(errors.name, "Full name is required");
  assert.equal(errors.email, "Email is required");
  assert.equal(errors.password, "Password is required");
  assert.equal(errors.confirmPassword, "Please confirm your password");
}

{
  const errors = validateRegisterForm({
    name: "   ",
    email: "   ",
    password: "",
    confirmPassword: "",
  });
  assert.equal(errors.name, "Full name is required", "whitespace-only name is required-empty");
  assert.equal(errors.email, "Email is required", "whitespace-only email is required-empty");
}

// ---- name bounds (2-100) ---------------------------------------------------
{
  assert.ok(
    validateRegisterForm({ ...valid, name: "A" }).name,
    "single-char name rejected"
  );
  assert.ok(
    validateRegisterForm({ ...valid, name: "A".repeat(101) }).name,
    "101-char name rejected"
  );
  assert.equal(
    validateRegisterForm({ ...valid, name: "  Jo  " }).name,
    undefined,
    "name is trimmed before length checks"
  );
}

// ---- email format ----------------------------------------------------------
for (const bad of ["plainaddress", "no@tld", "two@@example.com", "sp ace@example.com", "@example.com", "user@.com"]) {
  const errors = validateRegisterForm({ ...valid, email: bad });
  assert.ok(errors.email, `invalid email must error: ${bad}`);
}

// ---- password policy (8-100) -----------------------------------------------
{
  assert.ok(
    validateRegisterForm({ ...valid, password: "Ab1!xyz", confirmPassword: "Ab1!xyz" }).password,
    "7-char password rejected"
  );
  assert.ok(
    validateRegisterForm({ ...valid, password: "A".repeat(101), confirmPassword: "A".repeat(101) }).password,
    "101-char password rejected"
  );
  assert.equal(
    validateRegisterForm({ ...valid, password: "Ab1!xyzz", confirmPassword: "Ab1!xyzz" }).password,
    undefined,
    "8-char password accepted"
  );
}

// ---- confirm password ------------------------------------------------------
{
  const errors = validateRegisterForm({ ...valid, confirmPassword: "different" });
  assert.equal(errors.confirmPassword, "Passwords do not match");
  assert.ok(
    validateRegisterForm({ ...valid, confirmPassword: "" }).confirmPassword,
    "empty confirm rejected"
  );
}

// ---- email normalization policy --------------------------------------------
assert.equal(normalizeEmail("  John.Doe@Example.COM  "), "john.doe@example.com");
assert.equal(normalizeEmail(undefined), "");

// ---- API fieldErrors mapping -----------------------------------------------
{
  const mapped = mapApiFieldErrors({
    name: "Name must be between 2 and 100 characters",
    email: "Email must be valid",
    password: "Password must be between 8 and 100 characters",
    confirmPassword: "Please confirm your password",
    someUnknownField: "ignored",
  });
  assert.deepEqual(mapped, {
    name: "Name must be between 2 and 100 characters",
    email: "Email must be valid",
    password: "Password must be between 8 and 100 characters",
    confirmPassword: "Please confirm your password",
  });
  assert.deepEqual(mapApiFieldErrors(null), {});
  assert.deepEqual(mapApiFieldErrors("nope"), {});
}

console.log("registerValidation.test.mjs: all assertions passed");
