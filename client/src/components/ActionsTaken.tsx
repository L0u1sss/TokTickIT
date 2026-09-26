import { type FormEvent, useEffect, useState } from "react";

export type ActionAssignee = { id: number; displayName: string; email?: string; role?: string };
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type ActionTaken = {
  id: number; description: string; result: string | null; status: ActionStatus;
  performedBy: ActionAssignee; assignee: ActionAssignee; followUpRequired: boolean;
  followUpNote: string | null; attachmentNotes: string | null; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
};
type Draft = { description: string; result: string; assigneeId: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string };

const emptyDraft = (): Draft => ({ description: "", result: "", assigneeId: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" });
const labels: Record<ActionStatus, string> = { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const transitions: Record<ActionStatus, ActionStatus[]> = { PLANNED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: ["IN_PROGRESS"], CANCELLED: ["PLANNED"] };

class ActionError extends Error { constructor(public code: string) { super(code); } }
const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const csrf = () => document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("toktickit_csrf="))?.slice("toktickit_csrf=".length);
async function request<T>(path: string, signal?: AbortSignal, method = "GET", body?: unknown): Promise<T> {
  const token = csrf();
  const response = await fetch(`${baseUrl}${path}`, { method, signal, credentials: "include", cache: "no-store",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { "X-CSRF-Token": token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ActionError(data.error?.code ?? "FAILURE"); }
  return response.json() as Promise<T>;
}
const safeMessage = (code: string) => ({
  FORBIDDEN: "You do not have permission to view or change these Actions.",
  NOT_FOUND: "The Ticket or Action could not be found.",
  STALE_ACTION: "This Action changed after you opened it. Reload the Actions before saving again.",
  INVALID_ACTION_ASSIGNEE: "The selected assignee is no longer active or eligible. Choose another assignee.",
  INVALID_ACTION_TRANSITION: "That status change is no longer allowed. Reload the Actions and try again.",
  IDEMPOTENCY_CONFLICT: "This create request conflicts with an earlier request. Review the form and try again.",
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
}[code] ?? "Unable to save the Action. Your entries have been kept; try again.");
const toDraft = (action: ActionTaken): Draft => ({ description: action.description, result: action.result ?? "", assigneeId: String(action.assignee.id), followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "" });
const payload = (draft: Draft) => ({ description: draft.description.trim(), result: draft.result.trim() || null, assigneeId: Number(draft.assigneeId), followUpRequired: draft.followUpRequired, followUpNote: draft.followUpRequired ? draft.followUpNote.trim() || null : null, attachmentNotes: draft.attachmentNotes.trim() || null });

export function ActionsTaken({ ticketId, staff = false, assignees = [] }: { ticketId: number; staff?: boolean; assignees?: ActionAssignee[] }) {
  const prefix = staff ? "/api/staff" : "/api";
  const [items, setItems] = useState<ActionTaken[]>([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0), [creating, setCreating] = useState(false), [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<number | null>(null), [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [saveError, setSaveError] = useState("");
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    request<{ items: ActionTaken[] }>(`${prefix}/tickets/${ticketId}/actions`, controller.signal).then(data => {
      if (!Array.isArray(data?.items)) throw new ActionError("FAILURE");
      if (!controller.signal.aborted) setItems(data.items);
    }).catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof ActionError ? error.code : "FAILURE"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [prefix, reload, ticketId]);

  const validate = (value: Draft) => {
    if (!value.description.trim()) return "Enter an Action description.";
    if (Array.from(value.description.trim()).length > 2000) return "Description must be 2,000 characters or fewer.";
    if (!value.assigneeId) return "Choose an assignee.";
    if (value.followUpRequired && !value.followUpNote.trim()) return "Enter a Follow-up Note when follow-up is required.";
    if (Array.from(value.result.trim()).length > 2000 || Array.from(value.followUpNote.trim()).length > 1000 || Array.from(value.attachmentNotes.trim()).length > 1000) return "One or more entries exceed the allowed length.";
    return "";
  };
  const beginEdit = (action: ActionTaken) => { setEditing(action.id); setEditDraft(toDraft(action)); setSaveError(""); setNotice(""); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); const validation = validate(draft); if (validation) { setSaveError(validation); return; }
    setBusy(true); setSaveError(""); setNotice("");
    try {
      await request(`${prefix}/tickets/${ticketId}/actions`, undefined, "POST", { clientRequestId, ...payload(draft) });
      setDraft(emptyDraft()); setCreating(false); setClientRequestId(crypto.randomUUID()); setNotice("Action created successfully."); setReload(value => value + 1);
    } catch (error) { setSaveError(error instanceof ActionError ? safeMessage(error.code) : safeMessage("FAILURE")); }
    finally { setBusy(false); }
  };
  const update = async (event: FormEvent, action: ActionTaken) => {
    event.preventDefault(); const validation = validate(editDraft); if (validation) { setSaveError(validation); return; }
    setBusy(true); setSaveError(""); setNotice("");
    try { await request(`${prefix}/tickets/${ticketId}/actions/${action.id}`, undefined, "PATCH", { revision: action.revision, ...payload(editDraft) }); setEditing(null); setNotice("Action updated successfully."); setReload(value => value + 1); }
    catch (error) { setSaveError(error instanceof ActionError ? safeMessage(error.code) : safeMessage("FAILURE")); }
    finally { setBusy(false); }
  };
  const transition = async (action: ActionTaken, status: ActionStatus) => {
    const result = editing === action.id ? editDraft.result.trim() : action.result?.trim() ?? "";
    if (status === "COMPLETED" && !result) { if (editing !== action.id) beginEdit(action); setSaveError("Enter a Result before completing this Action."); return; }
    if (status === "CANCELLED" && !window.confirm("Cancel this Action?")) return;
    setBusy(true); setSaveError(""); setNotice("");
    try { await request(`${prefix}/tickets/${ticketId}/actions/${action.id}/status`, undefined, "PATCH", { status, revision: action.revision, ...(status === "COMPLETED" ? { result } : {}) }); setEditing(null); setNotice(`Action changed to ${labels[status]}.`); setReload(value => value + 1); }
    catch (error) { setSaveError(error instanceof ActionError ? safeMessage(error.code) : safeMessage("FAILURE")); }
    finally { setBusy(false); }
  };

  return <section className="actions-taken" aria-labelledby={`actions-heading-${ticketId}`}>
    <div className="actions-heading"><div><h3 id={`actions-heading-${ticketId}`}>Actions Taken</h3><p>{staff ? "Work performed for this Ticket. Requesters can also see these entries." : "Work recorded by the IT team for this Ticket."}</p></div>
      {staff && !creating && <button type="button" className="zen-button" onClick={() => { setCreating(true); setSaveError(""); setNotice(""); }}>Add Action</button>}</div>
    {notice && <p role="status" aria-live="polite" className="action-notice">{notice}</p>}
    {saveError && <div role="alert" className="action-error"><p>{saveError}</p>{saveError.includes("Reload") && <button type="button" onClick={() => setReload(value => value + 1)}>Reload Actions</button>}</div>}
    {staff && creating && <ActionForm title="Create Action" draft={draft} setDraft={setDraft} assignees={assignees} busy={busy} submitLabel="Create Action" onSubmit={save} onCancel={() => { setCreating(false); setSaveError(""); }} />}
    {loading && <p role="status">Loading Actions…</p>}
    {!loading && loadError && <div role="alert"><p>{safeMessage(loadError).replace("save the Action. Your entries have been kept; try again.", "load Actions. Try again.")}</p><button type="button" onClick={() => { setLoading(true); setLoadError(""); setReload(value => value + 1); }}>Retry</button></div>}
    {!loading && !loadError && items.length === 0 && <p className="actions-empty">No Actions have been recorded for this Ticket.</p>}
    {!loading && !loadError && items.length > 0 && <ol className="action-list">{items.map(action => <li key={action.id} className="action-card">
      <header><span className={`action-status action-status-${action.status.toLowerCase()}`}>{labels[action.status]}</span><time dateTime={action.createdAt}>{new Date(action.createdAt).toLocaleString()}</time></header>
      {editing === action.id ? <ActionForm title="Edit Action" draft={editDraft} setDraft={setEditDraft} assignees={assignees} busy={busy} submitLabel="Save changes" onSubmit={event => update(event, action)} onCancel={() => { setEditing(null); setSaveError(""); }} /> : <>
        <p className="action-description">{action.description}</p><dl className="action-metadata"><div><dt>Performed by</dt><dd>{action.performedBy.displayName}</dd></div><div><dt>Assigned to</dt><dd>{action.assignee.displayName}</dd></div><div><dt>Result</dt><dd>{action.result ?? "Not recorded"}</dd></div><div><dt>Follow-up</dt><dd>{action.followUpRequired ? action.followUpNote : "Not required"}</dd></div><div><dt>Attachment notes</dt><dd>{action.attachmentNotes ?? "None"}</dd></div></dl>
      </>}
      {staff && editing !== action.id && <div className="action-controls"><button type="button" disabled={busy} onClick={() => beginEdit(action)}>Edit Action</button>{transitions[action.status].map(status => <button type="button" key={status} disabled={busy} onClick={() => void transition(action, status)}>{status === "IN_PROGRESS" ? (action.status === "COMPLETED" ? "Reopen Action" : "Start Action") : status === "PLANNED" ? "Restore Action" : status === "COMPLETED" ? "Complete Action" : "Cancel Action"}</button>)}</div>}
    </li>)}</ol>}
  </section>;
}

function ActionForm({ title, draft, setDraft, assignees, busy, submitLabel, onSubmit, onCancel }: { title: string; draft: Draft; setDraft: (draft: Draft) => void; assignees: ActionAssignee[]; busy: boolean; submitLabel: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const change = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft({ ...draft, [field]: value });
  return <form className="action-form" noValidate onSubmit={onSubmit}><fieldset disabled={busy}><legend>{title}</legend>
    <label>Description <span aria-hidden="true">*</span><textarea aria-label={`${title} Description`} value={draft.description} maxLength={2000} required onChange={event => change("description", event.target.value)} /></label>
    <label>Assignee <span aria-hidden="true">*</span><select aria-label={`${title} Assignee`} value={draft.assigneeId} required onChange={event => change("assigneeId", event.target.value)}><option value="">Select an active staff member</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.displayName}{person.email ? ` (${person.email})` : ""}</option>)}</select></label>
    <label>Result<textarea aria-label={`${title} Result`} value={draft.result} maxLength={2000} onChange={event => change("result", event.target.value)} /></label>
    <label className="action-checkbox"><input type="checkbox" checked={draft.followUpRequired} onChange={event => change("followUpRequired", event.target.checked)} /> Follow-up required</label>
    {draft.followUpRequired && <label>Follow-up Note <span aria-hidden="true">*</span><textarea aria-label={`${title} Follow-up Note`} value={draft.followUpNote} maxLength={1000} required onChange={event => change("followUpNote", event.target.value)} /></label>}
    <label>Attachment notes<textarea aria-label={`${title} Attachment notes`} value={draft.attachmentNotes} maxLength={1000} onChange={event => change("attachmentNotes", event.target.value)} /></label>
    <div className="action-controls"><button type="submit" className="zen-button">{busy ? "Saving…" : submitLabel}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </fieldset></form>;
}
