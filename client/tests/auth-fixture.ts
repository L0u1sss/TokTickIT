import { vi } from "vitest";
import * as auth from "../src/context/AuthContext.js";
import type { Requester } from "../src/api.js";

export function mockRequesterSession(requester: Requester) {
  return vi.spyOn(auth, "useAuth").mockReturnValue({
    user: { ...requester, role: "REQUESTER", mustChangePassword: false },
    loading: false, error: "", logoutError: "",
    refresh: vi.fn().mockResolvedValue(undefined), logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(undefined), changePassword: vi.fn().mockResolvedValue(undefined),
  });
}
