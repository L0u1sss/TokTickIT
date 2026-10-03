import { useRef, useState } from "react";

const transitions: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
};
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
const confirmations = new Set(["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"]);

class WorkflowError extends Error { constructor(public code: string) { super(code); } }
const safeMessage = (code: string) => ({
  RESOLUTION_GATE_NOT_MET: "Complete at least one Action with a Result in the current workflow cycle, finish active Actions, and clear outstanding follow-up before resolving this Ticket.",
  STALE_TICKET: "This Ticket changed after you opened it. Reload the Ticket before changing its status.",
  INVALID_STATUS_TRANSITION: "That status change is no longer allowed. Reload the Ticket to see its current state.",
  FORBIDDEN: "You do not have permission to change this Ticket status.",
  NOT_FOUND: "This Ticket could not be found.",
  VALIDATION_ERROR: "The status request was invalid. Reload the Ticket and try again.",
}[code] ?? "Unable to change the Ticket status. Reload the Ticket and try again.");

type WorkflowProps = { ticketId: number; status: string; expectedTicketVersion: number; disabled?: boolean; onChange?: (status: string) => Promise<void>; onReload: () => void | Promise<void> };

export function TicketWorkflow(props: WorkflowProps) {
  return <WorkflowControls key={`${props.ticketId}/${props.status}/${props.expectedTicketVersion}`} {...props} />;
}

function WorkflowControls({ ticketId, status, expectedTicketVersion, disabled = false, onChange, onReload }: WorkflowProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [errorCode, setErrorCode] = useState(""), [pending, setPending] = useState("");
  const busyRef = useRef(false);
  const change = async (nextStatus: string) => {
    if (nextStatus === status || disabled || busyRef.current) return;
    if (confirmations.has(nextStatus) && !window.confirm(`Confirm changing this Ticket to ${label(nextStatus)}?`)) return;
    busyRef.current = true; setBusy(true); setError(""); setErrorCode(""); setPending(nextStatus);
    const csrfToken = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("toktickit_csrf="))?.slice("toktickit_csrf=".length);
    try {
      if (onChange) { await onChange(nextStatus); return; }
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/staff/tickets/${ticketId}/status`, {
        method: "PATCH", credentials: "include", cache: "no-store", headers: { "content-type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
        body: JSON.stringify({ status: nextStatus, expectedTicketVersion }),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new WorkflowError(data.error?.code ?? "FAILURE"); }
      await onReload();
    } catch (failure) {
      const code = failure instanceof WorkflowError ? failure.code : "FAILURE";
      setErrorCode(code); setError(safeMessage(code));
    } finally { busyRef.current = false; setBusy(false); }
  };
  const reloadRequired = ["STALE_TICKET", "INVALID_STATUS_TRANSITION", "VALIDATION_ERROR", "FAILURE"].includes(errorCode);
  const reload = async () => {
    if (disabled || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await onReload(); }
    catch { setErrorCode("FAILURE"); setError("Unable to reload the Ticket. Try Reload Ticket again."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="ticket-workflow">
    <label>Status<select aria-label="Status" disabled={disabled || busy || reloadRequired} value={status} onChange={event => void change(event.target.value)}>
      {[status, ...(transitions[status] ?? [])].map(value => <option key={value} value={value}>{label(value)}</option>)}
    </select></label>
    {busy && <span role="status">Changing status…</span>}
    {error && <div className="workflow-error" role="alert"><p>{error}</p>
      {errorCode === "RESOLUTION_GATE_NOT_MET" && <a href="#actions">Review Actions Taken</a>}
      {reloadRequired && <button className="zen-button secondary-button" type="button" disabled={disabled || busy} onClick={() => void reload()}>Reload Ticket</button>}
      {errorCode === "FAILURE" && pending && <button className="zen-button secondary-button" type="button" disabled={disabled || busy} onClick={() => void change(pending)}>Retry status change</button>}
    </div>}
  </div>;
}
