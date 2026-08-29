export type ApiErrorCode =
  | "INVALID_JSON"
  | "INVALID_REQUESTER_CONTEXT"
  | "INVALID_QUERY"
  | "VALIDATION_ERROR"
  | "INVALID_REFERENCE"
  | "DUPLICATE_REQUEST_CONFLICT"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field: string;
  issue: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ErrorDetail[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(details: ErrorDetail[]): ApiError {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "The request contains invalid fields.",
    details,
  );
}

export function invalidQueryError(details: ErrorDetail[]): ApiError {
  return new ApiError(
    400,
    "INVALID_QUERY",
    "The ticket list query is invalid.",
    details,
  );
}

export function invalidReferenceError(details: ErrorDetail[]): ApiError {
  return new ApiError(
    400,
    "INVALID_REFERENCE",
    "The request contains unavailable reference data.",
    details,
  );
}

export function duplicateRequestConflict(): ApiError {
  return new ApiError(
    409,
    "DUPLICATE_REQUEST_CONFLICT",
    "clientRequestId was already used for a different request.",
  );
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: {
    error: {
      code: ApiErrorCode;
      message: string;
      details?: ErrorDetail[];
    };
  };
} {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && error.details.length > 0
            ? { details: error.details }
            : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    },
  };
}
