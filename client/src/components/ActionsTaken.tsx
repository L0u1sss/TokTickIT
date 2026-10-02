import { type FormEvent, useEffect, useId, useRef, useState } from "react";

export type ActionAssignee = { id: number; displayName: string; email?: string; role?: string };
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type ActionTaken = {
  id: number; description: string; result: string | null; status: ActionStatus;
  recordedBy?: ActionAssignee; performedBy: ActionAssignee | null; assignee: ActionAssignee;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  revision: number; createdAt: string; updatedAt: string; completedAt: string | null;
  cancelledAt: string | null; cancelledBy: ActionAssignee | null;
  cancellationSource: "STAFF_ACTION" | "TICKET_CASCADE" | null;
};
type Draft = { description: string; result: string; assigneeId: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string };
type FieldErrors = Partial<Record<keyof Draft, string>>;
type Props = {
  ticketId: number; staff?: boolean; assignees?: ActionAssignee[];
  ticketVersion?: number; ticketStatus?: string; currentUserId?: number;
  onTicketVersionChange?: (version: number) => void;
  onReloadTicket?: () => Promise<{ version: number; status: string }>;
  ticketBusy?: boolean; ticketNeedsReload?: boolean; onBusyChange?: (busy: boolean) => void;
  onTicketNeedsReloadChange?: (needsReload: boolean) => void;
  refreshKey?: number; onAssigneesReload?: () => void;
};

const emptyDraft = (): Draft => ({ description: "", result: "", assigneeId: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" });
const labels: Record<ActionStatus, string> = { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const transitions: Record<ActionStatus, ActionStatus[]> = { PLANNED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
const actionable = (status?: string) => Boolean(status && ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(status));
const positive = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const terminal = (action: ActionTaken) => action.status === "COMPLETED" || action.status === "CANCELLED";
const protectedCodes = ["FORBIDDEN", "NOT_FOUND", "AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"];
const reloadCodes = ["STALE_ACTION", "STALE_TICKET", "TICKET_NOT_ACTIONABLE", "INVALID_ACTION_TRANSITION", "ACTION_ASSIGNEE_REQUIRED", "UNCERTAIN_RESPONSE"];
const fieldNames: Record<keyof Draft, string> = { description: "Description", result: "Result", assigneeId: "Assignee", followUpRequired: "Follow-up required", followUpNote: "Follow-up Note", attachmentNotes: "Attachment Notes" };
const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
class ActionError extends Error { constructor(public code: string, public fields: FieldErrors = {}) { super(code); } }
const safeMessage = (code: string) => ({
  FORBIDDEN: "You do not have permission to view or change these Actions.",
  NOT_FOUND: "The Ticket or Action could not be found.",
  AUTHENTICATION_REQUIRED: "Your session has ended. Sign in again to continue.",
  PASSWORD_CHANGE_REQUIRED: "Change your password before continuing.",
  STALE_ACTION: "This Action changed after you opened it. Your draft has been kept. Reload the Actions and review it before saving again.",
  STALE_TICKET: "This Ticket changed after you opened it. Your draft has been kept. Reload the Ticket and Actions before saving again.",
  TICKET_NOT_ACTIONABLE: "Actions are read-only while the Ticket is resolved, closed or cancelled. Reload to see its current status.",
  INVALID_ACTION_ASSIGNEE: "The selected assignee is no longer active or eligible. Choose another assignee.",
  ACTION_ASSIGNEE_REQUIRED: "Only the assigned staff member can complete this Action. Reload to see the current assignment.",
  INVALID_ACTION_TRANSITION: "That status change is no longer allowed. Reload the Actions and review the latest state.",
  IDEMPOTENCY_CONFLICT: "This create request conflicts with an earlier request. Cancel this form and start a new Action if you intended different work.",
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
  UNCERTAIN_RESPONSE: "Unable to confirm the saved Action. Your draft has been kept. Reload before trying again.",
  SUMMARY_REFRESH_FAILED: "The Action was saved, but the Ticket summary could not be refreshed. Reload before changing more work.",
}[code] ?? "Unable to save the Action. Your entries have been kept; try again.");

function isAction(value: unknown): value is ActionTaken {
  if (!value || typeof value !== "object") return false;
  const action = value as ActionTaken;
  return positive(action.id) && positive(action.revision) && typeof action.description === "string"
    && Object.hasOwn(labels, action.status) && positive(action.assignee?.id) && typeof action.assignee.displayName === "string"
    && (action.performedBy === null || typeof action.performedBy?.displayName === "string")
    && typeof action.followUpRequired === "boolean" && typeof action.createdAt === "string" && typeof action.updatedAt === "string";
}
const chronological = (items: ActionTaken[]) => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
async function request<T>(path: string, signal?: AbortSignal, method = "GET", body?: unknown): Promise<T> {
  const token = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("toktickit_csrf="))?.slice("toktickit_csrf=".length);
  const response = await fetch(`${baseUrl}${path}`, { method, signal, credentials: "include", cache: "no-store",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { "X-CSRF-Token": token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    const data = await response.json().catch(() => null), fields: FieldErrors = {};
    if (Array.isArray(data?.error?.details)) for (const detail of data.error.details) {
      if (detail && Object.hasOwn(fieldNames, detail.field)) {
        const field = detail.field as keyof Draft;
        fields[field] = `Check ${fieldNames[field]} and try again.`;
      }
    }
    throw new ActionError(typeof data?.error?.code === "string" ? data.error.code : "FAILURE", fields);
  }
  return response.json() as Promise<T>;
}
async function list(path: string, signal?: AbortSignal) {
  const data = await request<{ items: ActionTaken[] }>(path, signal);
  if (!Array.isArray(data?.items) || !data.items.every(isAction)) throw new ActionError("FAILURE");
  return chronological(data.items);
}
const toDraft = (action: ActionTaken): Draft => ({ description: action.description, result: action.result ?? "", assigneeId: String(action.assignee.id), followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "" });
const payload = (draft: Draft) => ({ description: draft.description.trim(), result: draft.result.trim() || null, assigneeId: Number(draft.assigneeId), followUpRequired: draft.followUpRequired, followUpNote: draft.followUpRequired ? draft.followUpNote.trim() || null : null, attachmentNotes: draft.attachmentNotes.trim() || null });
function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, maximum] of [["description", 2000], ["result", 2000], ["followUpNote", 1000], ["attachmentNotes", 1000]] as const) {
    if (field === "followUpNote" && !draft.followUpRequired) continue;
    const text = draft[field].trim();
    if (text.includes("\u0000") || Array.from(text).length > maximum) errors[field] = `${fieldNames[field]} must be plain text of ${maximum.toLocaleString("en-US")} characters or fewer.`;
  }
  if (!draft.description.trim()) errors.description = "Enter an Action description.";
  if (!positive(Number(draft.assigneeId))) errors.assigneeId = "Choose an assignee.";
  if (draft.followUpRequired && !draft.followUpNote.trim()) errors.followUpNote = "Enter a Follow-up Note when follow-up is required.";
  return errors;
}

export function ActionsTaken({ ticketId, staff = false, assignees = [], ticketVersion, ticketStatus, currentUserId,
  onTicketVersionChange, onReloadTicket, ticketBusy = false, ticketNeedsReload = false, onBusyChange,
  onTicketNeedsReloadChange, refreshKey = 0, onAssigneesReload }: Props) {
  const path = `/api/${staff ? "staff/" : ""}tickets/${ticketId}/actions`;
  const [items, setItems] = useState<ActionTaken[]>([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0), [creating, setCreating] = useState(false), [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<number | null>(null), [editDraft, setEditDraft] = useState<Draft>(emptyDraft), [editRevision, setEditRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}), [needsReload, setNeedsReload] = useState(false);
  const [focusAttempt, setFocusAttempt] = useState(0);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const lock = useRef(false), version = useRef(ticketVersion);
  const addButton = useRef<HTMLButtonElement>(null), editButtons = useRef(new Map<number, HTMLButtonElement>()), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { version.current = ticketVersion; }, [ticketVersion]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve(); if (controller.signal.aborted) return;
      setLoading(true); setLoadError("");
      try { const next = await list(path, controller.signal); if (!controller.signal.aborted) setItems(next); }
      catch (error) { if (!controller.signal.aborted) setLoadError(error instanceof ActionError ? error.code : "FAILURE"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [path, reload, refreshKey]);

  const protectedView = protectedCodes.includes(loadError) || protectedCodes.includes(saveError);
  const canWrite = staff && actionable(ticketStatus) && positive(ticketVersion) && !protectedView;
  const blocked = busy || ticketBusy || loading || Boolean(loadError) || needsReload || ticketNeedsReload;
  const begin = () => {
    if (lock.current || blocked || !canWrite) return false;
    lock.current = true; setBusy(true); onBusyChange?.(true); setNotice(""); setSaveError(""); setFieldErrors({}); return true;
  };
  const finish = () => { lock.current = false; setBusy(false); onBusyChange?.(false); };
  const fail = (error: unknown, mutation = true) => {
    const code = error instanceof ActionError ? error.code : "FAILURE";
    setSaveError(code); setFieldErrors(error instanceof ActionError ? error.fields : {});
    if (code === "VALIDATION_ERROR") setFocusAttempt(value => value + 1);
    if (reloadCodes.includes(code) || (mutation && (!(error instanceof ActionError) || ["FAILURE", "INTERNAL_ERROR"].includes(code)))) {
      setNeedsReload(true); onTicketNeedsReloadChange?.(true);
    }
    if (protectedCodes.includes(code)) { setCreating(false); setEditing(null); }
  };
  const accept = (data: { action: ActionTaken; ticketVersion: number }, actionId?: number) => {
    if (!isAction(data?.action) || !positive(data?.ticketVersion) || (actionId !== undefined && data.action.id !== actionId)) throw new ActionError("UNCERTAIN_RESPONSE");
    version.current = data.ticketVersion; onTicketVersionChange?.(data.ticketVersion);
    setNeedsReload(false); onTicketNeedsReloadChange?.(false);
    setItems(previous => chronological([...previous.filter(action => action.id !== data.action.id), data.action]));
  };
  const refreshSummary = async () => {
    if (!onReloadTicket) return;
    try {
      const ticket = await onReloadTicket();
      if (!positive(ticket?.version)) throw new ActionError("UNCERTAIN_RESPONSE");
      version.current = ticket.version; onTicketVersionChange?.(ticket.version);
    } catch (error) {
      if (error instanceof ActionError && protectedCodes.includes(error.code)) fail(error, false);
      else { setSaveError("SUMMARY_REFRESH_FAILED"); setNeedsReload(true); onTicketNeedsReloadChange?.(true); }
    }
  };
  const returnFocus = (actionId?: number) => {
    window.setTimeout(() => { (actionId === undefined ? addButton.current : editButtons.current.get(actionId))?.focus(); }, 0);
  };
  const changeFieldErrors = (errors: FieldErrors) => {
    setFieldErrors(errors);
    if (!Object.keys(errors).length && saveError === "VALIDATION_ERROR") setSaveError("");
  };
  const beginEdit = (action: ActionTaken) => {
    if (!canWrite || blocked || terminal(action)) return;
    setCreating(false); setEditing(action.id); setEditDraft(toDraft(action)); setEditRevision(action.revision);
    setSaveError(""); setFieldErrors({}); setNotice("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (blocked || !canWrite) return;
    const errors = validate(draft); if (Object.keys(errors).length) { setFieldErrors(errors); setSaveError("VALIDATION_ERROR"); setFocusAttempt(value => value + 1); return; }
    if (!begin()) return;
    try {
      const data = await request<{ action: ActionTaken; ticketVersion: number }>(path, undefined, "POST", { clientRequestId, expectedTicketVersion: version.current, ...payload(draft) });
      accept(data); setDraft(emptyDraft()); setCreating(false); setClientRequestId(crypto.randomUUID()); setNotice("Action created successfully.");
      await refreshSummary(); returnFocus();
    } catch (error) { fail(error); } finally { finish(); }
  };
  const update = async (event: FormEvent, action: ActionTaken) => {
    event.preventDefault(); if (blocked || !canWrite || terminal(action)) return;
    const errors = validate(editDraft); if (Object.keys(errors).length) { setFieldErrors(errors); setSaveError("VALIDATION_ERROR"); setFocusAttempt(value => value + 1); return; }
    if (!begin()) return;
    try {
      const data = await request<{ action: ActionTaken; ticketVersion: number }>(`${path}/${action.id}`, undefined, "PATCH", { expectedTicketVersion: version.current, revision: editRevision, ...payload(editDraft) });
      accept(data, action.id); setEditing(null); setNotice("Action updated successfully."); await refreshSummary(); returnFocus(action.id);
    } catch (error) { fail(error); } finally { finish(); }
  };
  const transition = async (action: ActionTaken, status: ActionStatus) => {
    if (blocked || !canWrite || !transitions[action.status].includes(status)) return;
    if (status === "COMPLETED" && action.assignee.id !== currentUserId) return;
    if ((status === "COMPLETED" && !action.result?.trim()) || (status !== "IN_PROGRESS" && action.followUpRequired)) {
      beginEdit(action); setSaveError("VALIDATION_ERROR"); setFocusAttempt(value => value + 1); setFieldErrors({
        ...(status === "COMPLETED" && !action.result?.trim() ? { result: "Enter a Result before completing this Action." } : {}),
        ...(action.followUpRequired ? { followUpRequired: `Clear follow-up and save your changes before ${status === "COMPLETED" ? "completing" : "cancelling"} this Action.` } : {}),
      }); return;
    }
    if (status === "CANCELLED" && !window.confirm("Cancel this Action? This terminal record cannot be reopened.")) return;
    if (!begin()) return;
    try {
      const data = await request<{ action: ActionTaken; ticketVersion: number }>(`${path}/${action.id}/status`, undefined, "PATCH", { status, expectedTicketVersion: version.current, revision: action.revision, ...(status === "COMPLETED" ? { result: action.result?.trim() } : {}) });
      accept(data, action.id); setNotice(`Action changed to ${labels[status]}.`); await refreshSummary();
      window.setTimeout(() => heading.current?.focus(), 0);
    } catch (error) { fail(error); } finally { finish(); }
  };
  const reloadLatest = async () => {
    if (lock.current || ticketBusy) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setNotice("");
    try {
      if (staff) {
        if (!onReloadTicket) throw new ActionError("UNCERTAIN_RESPONSE");
        const ticket = await onReloadTicket();
        if (!positive(ticket?.version) || typeof ticket.status !== "string") throw new ActionError("UNCERTAIN_RESPONSE");
        version.current = ticket.version; onTicketVersionChange?.(ticket.version);
      }
      const next = await list(path); setItems(next); setLoading(false); setLoadError(""); setNeedsReload(false); onTicketNeedsReloadChange?.(false); setSaveError(""); setFieldErrors({});
      if (editing !== null) { const action = next.find(item => item.id === editing); if (action) setEditRevision(action.revision); }
      setNotice("Latest Ticket and Actions loaded. Review your draft before saving again.");
    } catch (error) { fail(error, false); } finally { finish(); }
  };
  const cancelCreate = () => { setCreating(false); setDraft(emptyDraft()); setClientRequestId(crypto.randomUUID()); setSaveError(""); setFieldErrors({}); returnFocus(); };
  const cancelEdit = () => { const id = editing; setEditing(null); setSaveError(""); setFieldErrors({}); if (id !== null) returnFocus(id); };
  const editingAction = items.find(action => action.id === editing);
  const showSaveError = saveError && !(saveError === "VALIDATION_ERROR" && Object.keys(fieldErrors).length);

  return <section id="actions" className="actions-taken" aria-labelledby={`actions-heading-${ticketId}`} aria-busy={loading || busy}>
    <div className="actions-heading"><div><h3 ref={heading} tabIndex={-1} id={`actions-heading-${ticketId}`}>Actions Taken</h3><p>Shared with the Requester, IT Staff and Administrator. Internal Notes are separate and private.</p></div>
      {canWrite && !creating && <button ref={addButton} type="button" className="zen-button" disabled={blocked} onClick={() => { setCreating(true); setEditing(null); setSaveError(""); setFieldErrors({}); setNotice(""); }}>Add Action</button>}</div>
    {staff && !actionable(ticketStatus) && !protectedView && <p>Actions are read-only while the Ticket is resolved, closed or cancelled. Reopen the Ticket to record new work.</p>}
    {staff && !positive(ticketVersion) && <p role="alert">Reload the Ticket before changing Actions.</p>}
    {notice && <p role="status" aria-live="polite" className="action-notice">{notice}</p>}
    {showSaveError && <div role="alert" className="action-error"><p>{safeMessage(saveError)}</p>{saveError === "AUTHENTICATION_REQUIRED" && <a href="/login">Sign in</a>}
      {saveError === "INVALID_ACTION_ASSIGNEE" && onAssigneesReload && <button className="zen-button secondary-button" type="button" disabled={busy || ticketBusy} onClick={onAssigneesReload}>Reload assignees</button>}</div>}
    {(needsReload || ticketNeedsReload) && !protectedView && <button type="button" className="zen-button secondary-button" disabled={busy || ticketBusy} onClick={() => void reloadLatest()}>Reload Actions</button>}
    {staff && creating && !protectedView && <ActionForm title="Create Action" draft={draft} setDraft={setDraft} assignees={assignees} disabled={blocked || !canWrite} errors={fieldErrors} onErrorsChange={changeFieldErrors} focusAttempt={focusAttempt} submitLabel="Create Action" saving={busy} onSubmit={save} onCancel={cancelCreate} />}
    {loading && <p role="status">Loading Actions…</p>}
    {!loading && loadError && <div role="alert" className="action-error"><p>{protectedCodes.includes(loadError) ? safeMessage(loadError) : "Unable to load Actions. Try again."}</p>
      <button type="button" className="zen-button secondary-button" disabled={busy || ticketBusy} onClick={() => { setSaveError(""); setReload(value => value + 1); }}>Retry</button></div>}
    {!loading && !loadError && !protectedView && items.length === 0 && <p className="actions-empty">No Actions have been recorded for this Ticket.</p>}
    {!loading && !loadError && !protectedView && items.length > 0 && <ol className="action-list">{items.map(action => <li key={action.id} className="action-card">
      <header><span className={`action-status action-status-${action.status.toLowerCase()}`}>{labels[action.status]}</span><span>Action Date/Time: <time dateTime={action.createdAt}>{new Date(action.createdAt).toLocaleString()}</time></span></header>
      {editing === action.id ? <ActionForm title="Edit Action" draft={editDraft} setDraft={setEditDraft} assignees={assignees} disabled={blocked || !canWrite || terminal(action)} errors={fieldErrors} onErrorsChange={changeFieldErrors} focusAttempt={focusAttempt} submitLabel="Save changes" saving={busy} onSubmit={event => update(event, action)} onCancel={cancelEdit} /> : <>
        <p className="action-description">{action.description}</p><dl className="action-metadata">
          {action.recordedBy && <div><dt>Recorded by</dt><dd>{action.recordedBy.displayName}</dd></div>}
          <div><dt>Performed by</dt><dd>{action.performedBy?.displayName ?? "Not completed"}</dd></div><div><dt>Assigned to</dt><dd>{action.assignee.displayName}</dd></div>
          <div><dt>Result</dt><dd>{action.result ?? "Not recorded"}</dd></div><div><dt>{action.status === "CANCELLED" && action.followUpRequired ? "Historical follow-up" : "Follow-up required"}</dt><dd>{action.followUpRequired ? `Yes — ${action.followUpNote}` : "No"}</dd></div>
          <div><dt>Attachment Notes</dt><dd>{action.attachmentNotes ?? "None"}</dd></div><div><dt>Last updated</dt><dd><time dateTime={action.updatedAt}>{new Date(action.updatedAt).toLocaleString()}</time></dd></div>
          {action.completedAt && <div><dt>Completed at</dt><dd><time dateTime={action.completedAt}>{new Date(action.completedAt).toLocaleString()}</time></dd></div>}
          {action.status === "CANCELLED" && <><div><dt>Cancelled by</dt><dd>{action.cancelledBy?.displayName ?? "Not recorded"}</dd></div><div><dt>Cancelled at</dt><dd>{action.cancelledAt ? <time dateTime={action.cancelledAt}>{new Date(action.cancelledAt).toLocaleString()}</time> : "Not recorded"}</dd></div><div><dt>Cancellation source</dt><dd>{action.cancellationSource === "TICKET_CASCADE" ? "Ticket cancellation" : "Staff cancellation"}</dd></div></>}
        </dl>
      </>}
      {canWrite && !terminal(action) && editing !== action.id && <div className="action-controls">
        <button ref={button => { if (button) editButtons.current.set(action.id, button); else editButtons.current.delete(action.id); }} type="button" className="zen-button secondary-button" disabled={blocked} onClick={() => beginEdit(action)}>Edit Action</button>
        {transitions[action.status].filter(status => status !== "COMPLETED" || currentUserId === action.assignee.id).map(status => <button type="button" className="zen-button secondary-button" key={status} disabled={blocked} onClick={() => void transition(action, status)}>{status === "IN_PROGRESS" ? "Start Action" : status === "COMPLETED" ? "Complete Action" : "Cancel Action"}</button>)}
      </div>}
      {staff && action.status === "IN_PROGRESS" && currentUserId !== action.assignee.id && <p>Only the assigned staff member can complete this Action.</p>}
      {terminal(action) && <p>This is a read-only terminal record. Later work must be recorded as a new Action.</p>}
      {action.status === "CANCELLED" && action.followUpRequired && <p>Historical follow-up is retained for reference; it is not outstanding work.</p>}
    </li>)}</ol>}
    {editingAction && terminal(editingAction) && <p role="status">This Action became terminal. Your draft is retained for reference; it cannot be saved to this record.</p>}
  </section>;
}

function ActionForm({ title, draft, setDraft, assignees, disabled, errors, onErrorsChange, focusAttempt, saving, submitLabel, onSubmit, onCancel }: {
  title: string; draft: Draft; setDraft: (draft: Draft) => void; assignees: ActionAssignee[];
  disabled: boolean; errors: FieldErrors; onErrorsChange: (errors: FieldErrors) => void; focusAttempt: number; saving: boolean; submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void;
}) {
  const prefix = useId(), description = useRef<HTMLTextAreaElement>(null), lastFocusAttempt = useRef(-1);
  useEffect(() => { description.current?.focus(); }, []);
  useEffect(() => {
    if (lastFocusAttempt.current === focusAttempt) return;
    lastFocusAttempt.current = focusAttempt;
    const field = Object.keys(errors)[0]; if (field) document.getElementById(`${prefix}-${field}`)?.focus();
  }, [errors, prefix, focusAttempt]);
  const id = (field: keyof Draft) => `${prefix}-${field}`;
  const errorId = (field: keyof Draft) => `${id(field)}-error`;
  const attributes = (field: keyof Draft) => ({ id: id(field), "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? errorId(field) : undefined });
  const message = (field: keyof Draft) => errors[field] && <span className="action-field-error" id={errorId(field)}>{errors[field]}</span>;
  const change = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft({ ...draft, [field]: value }); const nextErrors = { ...errors }; delete nextErrors[field]; onErrorsChange(nextErrors);
  };
  return <form className="action-form" noValidate onSubmit={onSubmit} onBlur={event => {
    const field = (Object.keys(fieldNames) as (keyof Draft)[]).find(key => id(key) === event.target.id);
    if (!field) return;
    const nextErrors = { ...errors }, issue = validate(draft)[field];
    if (issue) nextErrors[field] = issue; else delete nextErrors[field];
    onErrorsChange(nextErrors);
  }} onKeyDown={event => { if (event.key === "Escape" && !saving) { event.preventDefault(); onCancel(); } }}>
    <p>Recorded by, Action Date/Time and initial status are set automatically. Performed by is set to the assigned staff member on completion.</p>
    {Object.keys(errors).length > 0 && <div role="alert" className="action-error"><p>Check the following fields:</p><ul>{(Object.keys(errors) as (keyof Draft)[]).map(field => <li key={field}><a href={`#${id(field)}`} onClick={event => { event.preventDefault(); document.getElementById(id(field))?.focus(); }}>{errors[field]}</a></li>)}</ul></div>}
    <fieldset disabled={disabled}><legend>{title}</legend>
      <label htmlFor={id("description")}>Description <span aria-hidden="true">*</span></label><textarea {...attributes("description")} ref={description} aria-label={`${title} Description`} value={draft.description} required onChange={event => change("description", event.target.value)} />{message("description")}
      <label htmlFor={id("assigneeId")}>Assignee <span aria-hidden="true">*</span></label><select {...attributes("assigneeId")} aria-label={`${title} Assignee`} value={draft.assigneeId} required onChange={event => change("assigneeId", event.target.value)}><option value="">Select an active staff member</option>
        {draft.assigneeId && !assignees.some(person => String(person.id) === draft.assigneeId) && <option value={draft.assigneeId}>Current assignee — reload choices to check eligibility</option>}
        {assignees.map(person => <option key={person.id} value={person.id}>{person.displayName}{person.email ? ` (${person.email})` : ""}</option>)}</select>{message("assigneeId")}
      <label htmlFor={id("result")}>Result</label><textarea {...attributes("result")} aria-label={`${title} Result`} value={draft.result} onChange={event => change("result", event.target.value)} />{message("result")}
      <label className="action-checkbox" htmlFor={id("followUpRequired")}><input {...attributes("followUpRequired")} type="checkbox" checked={draft.followUpRequired} onChange={event => {
        setDraft({ ...draft, followUpRequired: event.target.checked, followUpNote: event.target.checked ? draft.followUpNote : "" });
        const nextErrors = { ...errors }; delete nextErrors.followUpRequired; if (!event.target.checked) delete nextErrors.followUpNote; onErrorsChange(nextErrors);
      }} /> Follow-up required</label>{message("followUpRequired")}
      {draft.followUpRequired && <><label htmlFor={id("followUpNote")}>Follow-up Note <span aria-hidden="true">*</span></label><textarea {...attributes("followUpNote")} aria-label={`${title} Follow-up Note`} value={draft.followUpNote} required onChange={event => change("followUpNote", event.target.value)} />{message("followUpNote")}</>}
      <label htmlFor={id("attachmentNotes")}>Attachment Notes</label><textarea {...attributes("attachmentNotes")} aria-label={`${title} Attachment Notes`} value={draft.attachmentNotes} onChange={event => change("attachmentNotes", event.target.value)} />{message("attachmentNotes")}
      <div className="action-controls"><button type="submit" className="zen-button">{saving ? "Saving…" : submitLabel}</button></div>
    </fieldset>
    <button className="zen-button secondary-button" type="button" disabled={saving} onClick={onCancel}>Cancel</button>
  </form>;
}
