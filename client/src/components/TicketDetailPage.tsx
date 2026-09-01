import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiResponseError,
  Attachment,
  downloadAttachment,
  getTicketDetail,
  removeAttachment,
  RequestedPriority,
  TicketDetail,
  uploadAttachment,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

const maxAttachmentBytes = 5_242_880;
const allowedTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["pdf", "application/pdf"],
]);

interface TicketDetailPageProps {
  ticketIdSegment: string;
  onBack: () => void;
}

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayPriority(priority: RequestedPriority) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function displayBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTicketId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (allowedTypes.get(extension) !== file.type.toLowerCase()) {
    return "Choose a JPG, PNG, WEBP, or PDF file.";
  }
  if (file.size < 1 || file.size > maxAttachmentBytes) {
    return "File must be 5 MB or smaller.";
  }
  return null;
}

function validateRemovalReason(value: string): string | null {
  const length = Array.from(value.trim()).length;
  return length >= 5 && length <= 500
    ? null
    : "Removal reason must be 5 to 500 characters.";
}

export default function TicketDetailPage({ ticketIdSegment, onBack }: TicketDetailPageProps) {
  const { currentRequester, requestAsCurrentRequester } = useRequester();
  const ticketId = parseTicketId(ticketIdSegment);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "bad-request" | "forbidden" | "missing" | "error">(
    ticketId === null ? "bad-request" : "loading",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadRetry, setDownloadRetry] = useState<Attachment | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [removalBusy, setRemovalBusy] = useState(false);
  const latestRequest = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mainContent = useRef<HTMLElement>(null);
  const removalDialog = useRef<HTMLElement>(null);
  const removalTrigger = useRef<HTMLElement | null>(null);
  const hasFocusedRoute = useRef(false);

  const load = useCallback(async () => {
    if (ticketId === null) {
      setTicket(null);
      setState("bad-request");
      return;
    }
    const requestId = ++latestRequest.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setTicket(null);
    setState("loading");
    try {
      const detail = await getTicketDetail(
        requestAsCurrentRequester,
        ticketId,
        nextController.signal,
      );
      if (requestId !== latestRequest.current) return;
      setTicket(detail);
      setState("ready");
    } catch (error) {
      if (
        requestId !== latestRequest.current ||
        (error instanceof Error && error.name === "AbortError")
      ) return;
      setTicket(null);
      if (error instanceof ApiResponseError && error.status === 403) setState("forbidden");
      else if (error instanceof ApiResponseError && error.status === 404) setState("missing");
      else if (error instanceof ApiResponseError && error.status === 400) setState("bad-request");
      else setState("error");
    }
  }, [requestAsCurrentRequester, ticketId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      controller.current?.abort();
      latestRequest.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (state !== "loading" && !hasFocusedRoute.current) {
      hasFocusedRoute.current = true;
      mainContent.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (!removing) return;
    const dialog = removalDialog.current;
    dialog?.querySelector<HTMLButtonElement>("[data-removal-cancel]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRemoval();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [removing]);

  if (!currentRequester) return null;

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setNotice("");
    setUploadFailed(false);
    setFileError(file ? validateFile(file) ?? "" : "");
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    if (!ticket || !selectedFile) return;
    const validation = validateFile(selectedFile);
    if (validation) {
      setFileError(validation);
      return;
    }
    if (ticket.activeAttachmentCount >= 5) {
      setFileError("This ticket already has 5 active attachments. Remove one before uploading another.");
      return;
    }
    setUploading(true);
    setUploadFailed(false);
    setFileError("");
    try {
      const attachment = await uploadAttachment(
        requestAsCurrentRequester, ticket.id, selectedFile,
      );
      setTicket({
        ...ticket,
        attachments: [...ticket.attachments, attachment],
        activeAttachmentCount: ticket.activeAttachmentCount + 1,
      });
      setNotice(`${attachment.fileName} uploaded`);
      setUploadFailed(false);
      setSelectedFile(null);
      const input = document.getElementById("attachment-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (error) {
      if (error instanceof ApiResponseError) {
        if (error.status === 403) {
          setTicket(null);
          setState("forbidden");
        } else if (error.status === 404) {
          setTicket(null);
          setState("missing");
        } else if (error.code === "ATTACHMENT_LIMIT_REACHED") {
          setFileError("This ticket already has 5 active attachments. Remove one before uploading another.");
        } else if (error.code === "ATTACHMENT_SIZE_INVALID") {
          setFileError("File must be 5 MB or smaller.");
        } else if (
          error.code === "ATTACHMENT_TYPE_NOT_ALLOWED" ||
          error.code === "ATTACHMENT_FILENAME_INVALID" ||
          error.code === "INVALID_MULTIPART"
        ) {
          setFileError("Choose a JPG, PNG, WEBP, or PDF file.");
        } else {
          setFileError("We couldn't upload this attachment. Try again.");
          setUploadFailed(true);
        }
      } else {
        setFileError("We couldn't upload this attachment. Try again.");
        setUploadFailed(true);
      }
    } finally {
      setUploading(false);
    }
  }

  async function startDownload(attachment: Attachment) {
    if (!ticket) return;
    setNotice("");
    setDownloadRetry(null);
    setDownloadingId(attachment.id);
    try {
      const download = await downloadAttachment(
        requestAsCurrentRequester, ticket.id, attachment.id,
      );
      if (typeof URL.createObjectURL === "function") {
        const url = URL.createObjectURL(download.blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = download.fileName ?? attachment.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      setNotice(`${attachment.fileName} download started`);
    } catch (error) {
      if (
        error instanceof ApiResponseError &&
        (error.code === "ATTACHMENT_NOT_AVAILABLE" || error.code === "ATTACHMENT_NOT_FOUND")
      ) {
        await load();
        setNotice("This attachment is no longer available for download.");
      } else if (error instanceof ApiResponseError && error.status === 403) {
        setTicket(null);
        setState("forbidden");
      } else {
        setNotice("We couldn't download this attachment. Try again.");
        setDownloadRetry(attachment);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  function openRemoval(attachment: Attachment) {
    removalTrigger.current = document.activeElement as HTMLElement | null;
    setRemoving(attachment);
    setReason("");
    setReasonError("");
  }

  function closeRemoval() {
    setRemoving(null);
    setReason("");
    setReasonError("");
    queueMicrotask(() => removalTrigger.current?.focus());
  }

  async function confirmRemoval(event: FormEvent) {
    event.preventDefault();
    if (!ticket || !removing) return;
    const trimmedReason = reason.trim();
    const validation = validateRemovalReason(reason);
    if (validation) {
      setReasonError(validation);
      return;
    }
    setRemovalBusy(true);
    setReasonError("");
    try {
      const removed = await removeAttachment(
        requestAsCurrentRequester,
        ticket.id,
        removing.id,
        trimmedReason,
      );
      setTicket({
        ...ticket,
        activeAttachmentCount: Math.max(0, ticket.activeAttachmentCount - 1),
        attachments: ticket.attachments.map((item) =>
          item.id === removed.id ? removed : item,
        ),
      });
      setNotice(`${removed.fileName} was removed`);
      setRemoving(null);
      setReason("");
      queueMicrotask(() => document.getElementById("attachments-heading")?.focus());
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 400) {
        setReasonError("Removal reason must be 5 to 500 characters.");
      } else if (error instanceof ApiResponseError && error.status === 403) {
        setRemoving(null);
        setTicket(null);
        setState("forbidden");
      } else if (error instanceof ApiResponseError && error.status === 404) {
        setRemoving(null);
        await load();
        setNotice("This attachment is no longer available.");
      } else {
        setReasonError("We couldn't remove this attachment. Try again.");
      }
    } finally {
      setRemovalBusy(false);
    }
  }

  const errorCopy = {
    "bad-request": "The ticket URL is invalid.",
    forbidden: "You don't have permission to view this ticket.",
    missing: "Ticket not found.",
    error: "We couldn't load this ticket.",
  } as const;

  if (state !== "ready" || !ticket) {
    return (
      <main ref={mainContent} className="ticket-detail-page" id="main-content" tabIndex={-1}>
        {state === "loading" ? (
          <div className="ticket-detail-state" role="status">
            <span className="requester-spinner" aria-hidden="true" />Loading ticket…
          </div>
        ) : (
          <div className="ticket-detail-state ticket-list-error" role="alert">
            <p>{errorCopy[state as keyof typeof errorCopy]}</p>
            <div className="detail-state-actions">
              {state === "error" && <button className="zen-button" type="button" onClick={() => void load()}>Retry</button>}
              <a href="/tickets" onClick={(event) => { event.preventDefault(); onBack(); }}>Back to My Tickets</a>
            </div>
          </div>
        )}
      </main>
    );
  }

  const activeAttachments = ticket.attachments.filter((attachment) => !attachment.isRemoved);
  const removedAttachments = ticket.attachments.filter((attachment) => attachment.isRemoved);

  return (
    <main ref={mainContent} className="ticket-detail-page" id="main-content" tabIndex={-1}>
      <a className="detail-back-link" href="/tickets" onClick={(event) => { event.preventDefault(); onBack(); }}>
        Back to My Tickets
      </a>
      <header className="ticket-detail-heading">
        <div><p className="eyebrow">Ticket Detail</p><h1>{ticket.ticketNumber}</h1></div>
        <span className="status-badge">New</span>
      </header>
      <div className="ticket-detail-layout">
        <section className="detail-surface ticket-detail-summary" aria-labelledby="ticket-summary-heading">
          <h2 id="ticket-summary-heading">{ticket.summary}</h2>
        </section>
        <aside className="detail-surface ticket-detail-metadata" aria-label="Ticket metadata">
          <h2>Ticket information</h2>
          <dl>
            <Metadata label="Requester" value={ticket.requester.displayName} />
            <Metadata label="Category" value={ticket.category.name} />
            <Metadata label="Related System" value={ticket.relatedSystem.name} />
            <Metadata label="Requested Priority" value={displayPriority(ticket.requestedPriority)} />
            <Metadata label="Ticket Date" value={displayDate(ticket.createdAt)} dateTime={ticket.createdAt} />
            <Metadata label="Last updated" value={displayDate(ticket.updatedAt)} dateTime={ticket.updatedAt} />
          </dl>
        </aside>
        <section className="detail-surface ticket-detail-description" aria-labelledby="ticket-description-heading">
          <h2 id="ticket-description-heading">Description</h2>
          <p className="ticket-description">{ticket.description}</p>
        </section>
        <AttachmentSection
          active={activeAttachments}
          removed={removedAttachments}
          activeCount={ticket.activeAttachmentCount}
          selectedFile={selectedFile}
          fileError={fileError}
          uploading={uploading}
          uploadFailed={uploadFailed}
          notice={notice}
          downloadRetry={downloadRetry}
          downloadingId={downloadingId}
          onChooseFile={chooseFile}
          onUpload={submitUpload}
          onDownload={startDownload}
          onRemove={openRemoval}
        />
      </div>
      {removing && (
        <div className="removal-dialog-backdrop">
          <section ref={removalDialog} className="removal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-attachment-title" aria-describedby="remove-attachment-description">
            <h2 id="remove-attachment-title">Remove attachment?</h2>
            <p id="remove-attachment-description">{removing.fileName} will remain in the audit history and cannot be downloaded.</p>
            <form onSubmit={confirmRemoval}>
              <label htmlFor="removal-reason">Removal reason <span aria-hidden="true">*</span></label>
              <textarea
                id="removal-reason"
                value={reason}
                aria-required="true"
                aria-invalid={Boolean(reasonError)}
                aria-describedby={reasonError ? "removal-reason-count removal-reason-error" : "removal-reason-count"}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (!validateRemovalReason(event.target.value)) setReasonError("");
                }}
                onBlur={() => setReasonError(validateRemovalReason(reason) ?? "")}
              />
              <span className="character-count" id="removal-reason-count">{Array.from(reason).length} / 500</span>
              {reasonError && <p className="field-error" id="removal-reason-error" role="alert">{reasonError}</p>}
              <div className="form-actions">
                <button data-removal-cancel className="secondary-button" type="button" disabled={removalBusy} onClick={closeRemoval}>Cancel</button>
                <button className="destructive-button" type="submit" disabled={removalBusy || Array.from(reason.trim()).length < 5 || Array.from(reason.trim()).length > 500}>
                  {removalBusy ? "Removing…" : "Remove attachment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metadata({ label, value, dateTime }: { label: string; value: string; dateTime?: string }) {
  return <div><dt>{label}</dt><dd>{dateTime ? <time dateTime={dateTime}>{value}</time> : value}</dd></div>;
}

interface AttachmentSectionProps {
  active: Attachment[];
  removed: Attachment[];
  activeCount: number;
  selectedFile: File | null;
  fileError: string;
  uploading: boolean;
  uploadFailed: boolean;
  notice: string;
  downloadRetry: Attachment | null;
  downloadingId: number | null;
  onChooseFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: (event: FormEvent) => void;
  onDownload: (attachment: Attachment) => void;
  onRemove: (attachment: Attachment) => void;
}

function AttachmentSection(props: AttachmentSectionProps) {
  const atLimit = props.activeCount >= 5;
  return (
    <section className="detail-surface attachment-section" aria-labelledby="attachments-heading">
      <h2 id="attachments-heading" tabIndex={-1}>Attachments ({props.activeCount}/5)</h2>
      <p id="attachment-rules">JPG, PNG, WEBP, or PDF; maximum 5 MB each; up to 5 active attachments.</p>
      <form className="attachment-upload" onSubmit={props.onUpload}>
        <label htmlFor="attachment-file">Choose attachment</label>
        <input
          id="attachment-file"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          disabled={props.uploading || atLimit}
          aria-invalid={Boolean(props.fileError)}
          aria-describedby={props.fileError ? "attachment-rules attachment-file-error" : "attachment-rules"}
          onChange={props.onChooseFile}
        />
        {props.selectedFile && <p>{props.uploading ? `${props.selectedFile.name} — Uploading…` : props.selectedFile.name}</p>}
        {props.fileError && <p className="field-error" id="attachment-file-error" role="alert">{props.fileError}</p>}
        {atLimit && <p className="warning-callout">This ticket already has 5 active attachments. Remove one before uploading another.</p>}
        <button className="zen-button" type="submit" disabled={!props.selectedFile || (Boolean(props.fileError) && !props.uploadFailed) || props.uploading || atLimit}>
          {props.uploading ? "Uploading…" : props.uploadFailed ? "Retry upload" : "Upload attachment"}
        </button>
      </form>
      {props.notice && <p className="attachment-notice" role="status" aria-live="polite">{props.notice}</p>}
      {props.downloadRetry && (
        <button className="secondary-button attachment-retry" type="button" onClick={() => props.onDownload(props.downloadRetry!)}>
          Retry download
        </button>
      )}
      {props.active.length === 0 ? <p>No active attachments.</p> : (
        <ul className="attachment-list">
          {props.active.map((attachment) => (
            <li key={attachment.id}>
              <div>
                <strong>{attachment.fileName}</strong>
                <span>{attachment.mediaType} · {displayBytes(attachment.sizeBytes)} · Uploaded <time dateTime={attachment.uploadedAt}>{displayDate(attachment.uploadedAt)}</time></span>
              </div>
              <div className="attachment-actions">
                <button className="secondary-button" type="button" disabled={props.downloadingId === attachment.id} aria-label={`Download ${attachment.fileName}`} onClick={() => props.onDownload(attachment)}>{props.downloadingId === attachment.id ? "Downloading…" : "Download"}</button>
                <button className="destructive-button" type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => props.onRemove(attachment)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {props.removed.length > 0 && (
        <details className="removed-attachments">
          <summary>Removed attachments ({props.removed.length})</summary>
          <ul className="attachment-list">
            {props.removed.map((attachment) => (
              <li key={attachment.id}>
                <div>
                  <strong>{attachment.fileName}</strong>
                  <span>{attachment.mediaType} · {displayBytes(attachment.sizeBytes)} · Uploaded <time dateTime={attachment.uploadedAt}>{displayDate(attachment.uploadedAt)}</time></span>
                  <span>Removed <time dateTime={attachment.removedAt ?? undefined}>{attachment.removedAt ? displayDate(attachment.removedAt) : ""}</time></span>
                  <span>Reason: <span>{attachment.removalReason}</span></span>
                </div>
                <span className="removed-badge">Removed — unavailable</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
