import { useState } from "react";

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
  RESOLUTION_GATE_NOT_MET: "Complete at least one Action with a Result before resolving this Ticket.",
  STALE_TICKET: "This Ticket changed after you opened it. Reload the Ticket before changing its status.",
  INVALID_STATUS_TRANSITION: "That status change is no longer allowed. Reload the Ticket to see its current state.",
  FORBIDDEN: "You do not have permission to change this Ticket status.",
  NOT_FOUND: "This Ticket could not be found.",
  VALIDATION_ERROR: "The status request was invalid. Reload the Ticket and try again.",
}[code] ?? "Unable to change the Ticket status. Reload the Ticket and try again.");

export function TicketWorkflow({ ticketId, status, expectedUpdatedAt, disabled = false, onReload }: { ticketId: number; status: string; expectedUpdatedAt: string; disabled?: boolean; onReload: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [errorCode, setErrorCode] = useState(""), [pending, setPending] = useState("");
  const change = async (nextStatus: string) => {
    if (nextStatus === status) return;
    if (confirmations.has(nextStatus) && !window.confirm(`Confirm changing this Ticket to ${label(nextStatus)}?`)) return;
    setBusy(true); setError(""); setErrorCode(""); setPending(nextStatus);
    const csrfToken = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("toktickit_csrf="))?.slice("toktickit_csrf=".length);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/staff/tickets/${ticketId}/status`, {
        method: "PATCH", credentials: "include", cache: "no-store", headers: { "content-type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
        body: JSON.stringify({ status: nextStatus, expectedUpdatedAt }),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new WorkflowError(data.error?.code ?? "FAILURE"); }
      onReload();
    } catch (failure) {
      const code = failure instanceof WorkflowError ? failure.code : "FAILURE";
      setErrorCode(code); setError(safeMessage(code));
    } finally { setBusy(false); }
  };
  const reloadRequired = ["STALE_TICKET", "INVALID_STATUS_TRANSITION", "VALIDATION_ERROR", "FAILURE"].includes(errorCode);
  return <div className="ticket-workflow">
    <label>Status<select aria-label="Status" disabled={disabled || busy} value={status} onChange={event => void change(event.target.value)}>
      {[status, ...(transitions[status] ?? [])].map(value => <option key={value} value={value}>{label(value)}</option>)}
    </select></label>
    {busy && <span role="status">Changing status…</span>}
    {error && <div className="workflow-error" role="alert"><p>{error}</p>
      {errorCode === "RESOLUTION_GATE_NOT_MET" && <a href="#actions">Review Actions Taken</a>}
      {reloadRequired && <button type="button" onClick={onReload}>Reload Ticket</button>}
      {errorCode === "FAILURE" && pending && <button type="button" onClick={() => void change(pending)}>Retry status change</button>}
    </div>}
  </div>;
}
