import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, validateNewPassword, verifyPassword } from "../../src/password.js";

describe("UT-01/UT-02 authentication validation", () => {
  it("canonicalizes email and rejects malformed/oversized input", () => {
    expect(normalizeEmail("  Person@Example.Test ")).toBe("person@example.test");
    for (const email of [null, "a@", "a b@example.test", "x".repeat(250)+"@x.test"]) {
      expect(() => normalizeEmail(email)).toThrow();
    }
  });
  it.each(["Abcdefghij1!", "Aa1"+"😀".repeat(125), "ก".repeat(9)+"Aa1", "Abcdefghijk1"])("accepts valid Unicode password %s", password => {
    expect(() => validateNewPassword(password)).not.toThrow();
  });
  it.each(["Abcdefghi1!", "Aa1"+"😀".repeat(126), " Abcdefghij1!", "Abcdefghij1! ", "abcdefghijkl", "ABCDEFGHIJK1", ""])("rejects invalid password %s", password => {
    expect(() => validateNewPassword(password)).toThrow();
  });
  it("uses independently salted Argon2id hashes and verifies exact password bytes", async () => {
    const password = "Abcdefghij1!😀";
    const a = await hashPassword(password), b = await hashPassword(password);
    expect(a).toMatch(/^\$argon2id\$/); expect(a).not.toBe(b);
    expect(await verifyPassword(a,password)).toBe(true);
    expect(await verifyPassword(a,password+" ")).toBe(false);
    expect(await verifyPassword("broken hash",password)).toBe(false);
  });
});
