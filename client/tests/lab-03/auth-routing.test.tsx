import { expect, it } from "vitest";
import { isAuthPath } from "../../src/auth-routing.js";

it.each(["/login", "/change-password", "/account"])("keeps %s and trailing-slash aliases in AuthApp", path => {
  for (const suffix of ["", "/", "///"]) expect(isAuthPath(path + suffix)).toBe(true);
});
it("does not classify legacy or similarly named routes as auth routes", () => {
  for (const path of ["/", "/tickets", "/account-other"]) expect(isAuthPath(path)).toBe(false);
});
