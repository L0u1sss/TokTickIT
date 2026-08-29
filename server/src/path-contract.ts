import { ApiError } from "./errors.js";

export function parsePositivePathId(value: string, field: "id" | "attId"): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ApiError(
      400,
      "INVALID_PATH_PARAMETER",
      "The path parameter is invalid.",
      [{ field, issue: "Must be a positive integer." }],
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiError(
      400,
      "INVALID_PATH_PARAMETER",
      "The path parameter is invalid.",
      [{ field, issue: "Must be a positive safe integer." }],
    );
  }
  return parsed;
}
