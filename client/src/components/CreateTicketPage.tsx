import {
  ChangeEvent,
  FocusEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiResponseError,
  createTicket,
  getTicketMetadata,
  RequestedPriority,
  TicketCreateResult,
  TicketMetadata,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

type MetadataState = "loading" | "ready" | "error";
type SubmissionState = "idle" | "submitting" | "retryable" | "conflict";
type EditableField =
  | "categoryId"
  | "relatedSystemId"
  | "summary"
  | "requestedPriority"
  | "description";

type FormValues = Record<EditableField, string>;
type FieldErrors = Partial<Record<EditableField, string>>;

const initialValues: FormValues = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  requestedPriority: "",
  description: "",
};

const emptyMetadata: TicketMetadata = {
  categories: [],
  relatedSystems: [],
};

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function validateCreateTicket(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[1-9]\d*$/.test(values.categoryId)) {
    errors.categoryId = "Select a category.";
  }
  if (!/^[1-9]\d*$/.test(values.relatedSystemId)) {
    errors.relatedSystemId = "Select a related system.";
  }
  if (!(["LOW", "MEDIUM", "HIGH"] as string[]).includes(values.requestedPriority)) {
    errors.requestedPriority = "Select a requested priority.";
  }
  const summaryLength = codePointLength(values.summary.trim());
  if (summaryLength < 5 || summaryLength > 120) {
    errors.summary = "Summary must be 5 to 120 characters.";
  }
  const descriptionLength = codePointLength(values.description.trim());
  if (descriptionLength < 10 || descriptionLength > 2000) {
    errors.description = "Description must be 10 to 2,000 characters.";
  }
  return errors;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayPriority(value: RequestedPriority): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

interface CreateTicketPageProps {
  onCancel?: () => void;
}

export default function CreateTicketPage({ onCancel }: CreateTicketPageProps) {
  const { currentRequester, requestAsCurrentRequester } = useRequester();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [metadata, setMetadata] = useState<TicketMetadata>(emptyMetadata);
  const [metadataState, setMetadataState] = useState<MetadataState>("loading");
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [result, setResult] = useState<TicketCreateResult | null>(null);
  const attemptId = useRef<string | null>(null);
  const metadataRequest = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const retryButton = useRef<HTMLButtonElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const focusErrorSummaryAfterRender = useRef(false);
  const touchedFields = useRef<Set<EditableField>>(new Set());

  const loadMetadata = useCallback(async () => {
    metadataRequest.current?.abort();
    const controller = new AbortController();
    metadataRequest.current = controller;
    setMetadataState("loading");
    setSubmissionMessage("");

    try {
      const nextMetadata = await getTicketMetadata(controller.signal);
      if (controller.signal.aborted) return;
      setMetadata(nextMetadata);
      setMetadataState("ready");
    } catch {
      if (controller.signal.aborted) return;
      setMetadata(emptyMetadata);
      setMetadataState("error");
      setSubmissionMessage("We couldn't load ticket options.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMetadata(), 0);
    return () => {
      window.clearTimeout(initialLoad);
      metadataRequest.current?.abort();
    };
  }, [loadMetadata]);

  useEffect(() => {
    if (metadataState === "error") retryButton.current?.focus();
  }, [metadataState]);

  const hasCategories = metadata.categories.length > 0;
  const hasRelatedSystems = metadata.relatedSystems.length > 0;
  const referenceDataAvailable =
    metadataState === "ready" && hasCategories && hasRelatedSystems;
  const retryLocked = submissionState === "retryable";
  const formDisabled = submissionState === "submitting" || retryLocked;
  const canSubmit =
    currentRequester !== null &&
    referenceDataAvailable &&
    !formDisabled &&
    submissionState !== "conflict";

  const errorSummary = useMemo(
    () =>
      (Object.entries(fieldErrors) as [EditableField, string | undefined][]).filter(
        (entry): entry is [EditableField, string] => Boolean(entry[1]),
      ),
    [fieldErrors],
  );

  useEffect(() => {
    if (
      focusErrorSummaryAfterRender.current &&
      showErrorSummary &&
      errorSummary.length > 0
    ) {
      errorSummaryRef.current?.focus();
      focusErrorSummaryAfterRender.current = false;
    }
  }, [errorSummary, showErrorSummary]);

  function updateFieldError(field: EditableField, nextValues: FormValues) {
    const nextError = validateCreateTicket(nextValues)[field];
    const nextErrors = { ...fieldErrors, [field]: nextError };
    const hasErrors = Object.values(nextErrors).some(Boolean);
    setFieldErrors(nextErrors);
    if (
      !hasErrors &&
      submissionMessage === "Check the highlighted fields and try again."
    ) {
      setSubmissionMessage("");
    }
    if (!hasErrors) {
      setShowErrorSummary(false);
    }
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const field = event.target.name as EditableField;
    const nextValues = { ...values, [field]: event.target.value };
    setValues(nextValues);
    if (touchedFields.current.has(field) || fieldErrors[field]) {
      updateFieldError(field, nextValues);
    }
    if (submissionState === "conflict") {
      setSubmissionState("idle");
      setSubmissionMessage("");
    }
  }

  function handleBlur(
    event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const field = event.currentTarget.name as EditableField;
    touchedFields.current.add(field);
    updateFieldError(field, { ...values, [field]: event.currentTarget.value });
  }

  function focusField(field: EditableField) {
    document.getElementById(field)?.focus();
  }

  async function performSubmission() {
    if (!currentRequester || submitting.current) return;
    submitting.current = true;
    const logicalAttemptId = attemptId.current ?? crypto.randomUUID();
    attemptId.current = logicalAttemptId;
    setSubmissionState("submitting");
    setSubmissionMessage("");

    try {
      const response = await createTicket(requestAsCurrentRequester, {
        clientRequestId: logicalAttemptId,
        categoryId: Number(values.categoryId),
        relatedSystemId: Number(values.relatedSystemId),
        summary: values.summary.trim(),
        requestedPriority: values.requestedPriority as RequestedPriority,
        description: values.description.trim(),
      });
      setResult(response);
      setSubmissionState("idle");
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 400) {
        const serverErrors: FieldErrors = {};
        for (const detail of error.details) {
          if (detail.field in initialValues) {
            serverErrors[detail.field as EditableField] = detail.issue;
          }
        }
        focusErrorSummaryAfterRender.current = Object.keys(serverErrors).length > 0;
        setShowErrorSummary(Object.keys(serverErrors).length > 0);
        setFieldErrors(serverErrors);
        setSubmissionState("idle");
        setSubmissionMessage(
          Object.keys(serverErrors).length > 0
            ? "Check the highlighted fields and try again."
            : "We couldn't create your ticket. Check the request and try again.",
        );
      } else if (
        error instanceof ApiResponseError &&
        error.code === "DUPLICATE_REQUEST_CONFLICT"
      ) {
        attemptId.current = null;
        setSubmissionState("conflict");
        setSubmissionMessage(
          "This submission ID was already used for different ticket information. Review the form before trying again.",
        );
      } else {
        setSubmissionState("retryable");
        setSubmissionMessage("We couldn't create your ticket. Try again.");
      }
    } finally {
      submitting.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const validationErrors = validateCreateTicket(values);
    focusErrorSummaryAfterRender.current = Object.keys(validationErrors).length > 0;
    setShowErrorSummary(Object.keys(validationErrors).length > 0);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmissionMessage("Check the highlighted fields and try again.");
      return;
    }

    void performSubmission();
  }

  function handleRetrySubmission() {
    if (submissionState !== "retryable") return;
    void performSubmission();
  }

  function createAnotherTicket() {
    attemptId.current = null;
    setValues(initialValues);
    setFieldErrors({});
    setShowErrorSummary(false);
    touchedFields.current.clear();
    setSubmissionState("idle");
    setSubmissionMessage("");
    setResult(null);
  }

  function cancelDraft() {
    const hasDraft = Object.values(values).some((value) => value.trim().length > 0);
    if (hasDraft && !window.confirm("Discard this ticket draft?")) return;
    onCancel?.();
  }

  if (!currentRequester) return null;

  if (result) {
    const { ticket, replayed } = result;
    return (
      <main className="ticket-page" id="main-content" tabIndex={-1}>
        <section className="ticket-success" aria-labelledby="ticket-success-title">
          <p className="eyebrow">Create Ticket</p>
          <h1 id="ticket-success-title">
            {replayed
              ? `Ticket ${ticket.ticketNumber} was already created.`
              : `Ticket ${ticket.ticketNumber} was created.`}
          </h1>
          <p role="status" aria-live="polite">
            {replayed
              ? "Showing the original ticket. No duplicate was created."
              : "Your request has been recorded with status New."}
          </p>
          <dl className="ticket-result-grid">
            <div>
              <dt>Ticket Number</dt>
              <dd>{ticket.ticketNumber}</dd>
            </div>
            <div>
              <dt>Ticket Date</dt>
              <dd>
                <time dateTime={ticket.createdAt}>{displayDate(ticket.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{ticket.status}</dd>
            </div>
            <div>
              <dt>Requested Priority</dt>
              <dd>{displayPriority(ticket.requestedPriority)}</dd>
            </div>
          </dl>
          <button className="zen-button" type="button" onClick={createAnotherTicket}>
            Create another Ticket
          </button>
          <p className="scope-note">
            Ticket Detail will be available when its Lab 2 increment is added.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="ticket-page" id="main-content" tabIndex={-1}>
      <div className="ticket-page-heading">
        <p className="eyebrow">Requester workspace</p>
        <h1>Create Ticket</h1>
        <p>Submit a new IT request. Every new ticket starts with status New.</p>
      </div>

      <section className="ticket-context" aria-label="Ticket context">
        <div>
          <span>Ticket Number</span>
          <strong>Generated after creation</strong>
        </div>
        <div>
          <span>Ticket Date</span>
          <strong>Set after creation</strong>
        </div>
        <div>
          <span>Requester</span>
          <strong>{currentRequester.displayName}</strong>
        </div>
      </section>

      <form
        className="create-ticket-form"
        noValidate
        aria-busy={submissionState === "submitting"}
        onSubmit={handleSubmit}
      >
        {metadataState === "loading" && (
          <div className="form-state" role="status" aria-live="polite">
            <span className="requester-spinner" aria-hidden="true" />
            <span>Loading ticket options…</span>
          </div>
        )}

        {metadataState === "error" && (
          <div className="form-state form-state-error" role="alert">
            <span>{submissionMessage}</span>
            <button
              ref={retryButton}
              className="secondary-button"
              type="button"
              onClick={() => void loadMetadata()}
            >
              Retry
            </button>
          </div>
        )}

        {metadataState === "ready" && !hasCategories && (
          <div className="form-state form-state-warning" role="status">
            No active categories are available. Ticket creation is unavailable.
          </div>
        )}
        {metadataState === "ready" && !hasRelatedSystems && (
          <div className="form-state form-state-warning" role="status">
            No active related systems are available. Ticket creation is unavailable.
          </div>
        )}

        {showErrorSummary && errorSummary.length > 0 && (
          <div
            ref={errorSummaryRef}
            className="form-error-summary"
            role="alert"
            tabIndex={-1}
            aria-labelledby="create-ticket-error-title"
          >
            <strong id="create-ticket-error-title">Check the form:</strong>
            <ul>
              {errorSummary.map(([field, message]) => (
                <li key={field}>
                  <a
                    href={`#${field}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focusField(field);
                    }}
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {submissionMessage && metadataState !== "error" && errorSummary.length === 0 && (
          <div
            className={`form-state ${submissionState === "conflict" ? "form-state-warning" : "form-state-error"}`}
            role="alert"
          >
            {submissionMessage}
          </div>
        )}

        <p className="required-legend">
          <span aria-hidden="true">*</span> Required
        </p>

        <div className="create-ticket-grid">
          <FormField id="categoryId" label="Category" error={fieldErrors.categoryId}>
            <select
              id="categoryId"
              name="categoryId"
              value={values.categoryId}
              disabled={metadataState !== "ready" || !hasCategories || formDisabled}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.categoryId)}
              aria-describedby={fieldErrors.categoryId ? "categoryId-error" : undefined}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select a category</option>
              {metadata.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="relatedSystemId"
            label="Related System"
            error={fieldErrors.relatedSystemId}
          >
            <select
              id="relatedSystemId"
              name="relatedSystemId"
              value={values.relatedSystemId}
              disabled={
                metadataState !== "ready" || !hasRelatedSystems || formDisabled
              }
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.relatedSystemId)}
              aria-describedby={
                fieldErrors.relatedSystemId ? "relatedSystemId-error" : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select a related system</option>
              {metadata.relatedSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="summary" label="Summary" error={fieldErrors.summary} fullWidth>
            <input
              id="summary"
              name="summary"
              type="text"
              value={values.summary}
              disabled={formDisabled}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.summary)}
              aria-describedby={`summary-counter${fieldErrors.summary ? " summary-error" : ""}`}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <span id="summary-counter" className="character-count">
              {codePointLength(values.summary)} / 120
            </span>
          </FormField>

          <FormField
            id="requestedPriority"
            label="Requested Priority"
            error={fieldErrors.requestedPriority}
          >
            <select
              id="requestedPriority"
              name="requestedPriority"
              value={values.requestedPriority}
              disabled={formDisabled}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.requestedPriority)}
              aria-describedby={
                fieldErrors.requestedPriority
                  ? "requestedPriority-error"
                  : undefined
              }
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select a requested priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </FormField>

          <FormField
            id="description"
            label="Description"
            error={fieldErrors.description}
            fullWidth
          >
            <textarea
              id="description"
              name="description"
              value={values.description}
              rows={7}
              disabled={formDisabled}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={`description-counter${fieldErrors.description ? " description-error" : ""}`}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <span id="description-counter" className="character-count">
              {codePointLength(values.description)} / 2000
            </span>
          </FormField>
        </div>

        <p className="attachment-guidance" role="note">
          You can add up to 5 attachments after creating the ticket.
        </p>

        <div className="form-actions">
          <button
            className="secondary-button cancel-ticket-button"
            type="button"
            disabled={submissionState === "submitting"}
            onClick={cancelDraft}
          >
            Cancel
          </button>
          {submissionState === "retryable" ? (
            <button
              className="zen-button"
              type="button"
              onClick={handleRetrySubmission}
            >
              Retry
            </button>
          ) : (
            <button
              className="zen-button create-ticket-button"
              type="submit"
              disabled={!canSubmit}
            >
              {submissionState === "submitting" ? "Creating ticket…" : "Create ticket"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

interface FormFieldProps {
  id: EditableField;
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

function FormField({ id, label, error, fullWidth, children }: FormFieldProps) {
  return (
    <div className={`ticket-field${fullWidth ? " ticket-field-full" : ""}`}>
      <label htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
