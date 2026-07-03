/**
 * Generates a scrypt hash for "jobnuanu0361" using the same algorithm
 * as lib/password.ts. Prints the hash to stdout for use in a raw SQL INSERT.
 *
 * Usage: node scripts/gen-hash.js
 */
import { randomBytes, scryptSync } from "crypto";

const password = "jobnuanu0361";
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`${salt}:${hash}`);
