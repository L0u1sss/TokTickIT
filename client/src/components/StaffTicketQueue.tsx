import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";

type Person = { id: number; displayName: string; email: string };
type Ticket = { id: number; ticketNumber: string; summary: string; category: { name: string };
  requester: Person; owner: Person | null; requestedPriority: string; itPriority: string; status: string;
  createdAt: string; updatedAt: string; description?: string; relatedSystem?: { name: string } };
type Queue = { items: Ticket[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } };
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const priorities = ["LOW", "MEDIUM", "HIGH"];
const label = (value: string) => ({ updatedAt: "Last Updated", createdAt: "Created Date", ticketNumber: "Ticket Number", itPriority: "IT Priority", asc: "Ascending", desc: "Descending" }[value]
  ?? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
class QueueError extends Error { constructor(public code: string) { super(code); } }
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/staff/${path}`, { credentials: "include", cache: "no-store", signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new QueueError(body.error?.code ?? "FAILURE");
  }
  return response.json() as Promise<T>;
}
function TicketFields({ ticket }: { ticket: Ticket }) {
  return <dl className="staff-ticket-fields">
    <div><dt>Category</dt><dd>{ticket.category.name}</dd></div>
    <div><dt>Requester</dt><dd>{ticket.requester.displayName}<br />{ticket.requester.email}</dd></div>
    <div><dt>Requested Priority</dt><dd><span className={`staff-badge priority-${ticket.requestedPriority.toLowerCase()}`}>{label(ticket.requestedPriority)}</span></dd></div>
    <div><dt>IT Priority</dt><dd><span className={`staff-badge priority-${ticket.itPriority.toLowerCase()}`}>{label(ticket.itPriority)}</span></dd></div>
    <div><dt>Current Status</dt><dd><span className="staff-badge">{label(ticket.status)}</span></dd></div>
    <div><dt>Ticket Owner</dt><dd>{ticket.owner?.displayName ?? "Unassigned"}</dd></div>
    <div><dt>Created Date</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
    <div><dt>Last Updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div>
  </dl>;
}
export default function StaffTicketQueue() {
  const { refresh } = useAuth();
  const [location, setLocation] = useState(window.location.pathname.startsWith("/staff/tickets") ? window.location.pathname + window.location.search : "/staff/tickets");
  const [revision, setRevision] = useState(0);
  const [queue, setQueue] = useState<Queue | null>(null), [detail, setDetail] = useState<Ticket | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<Person[]>([]), [ownerError, setOwnerError] = useState(false);
  const [ownerRevision, setOwnerRevision] = useState(0);
  const pathname = location.split("?")[0], search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const isDetail = pathname !== "/staff/tickets";
  useEffect(() => {
    const restore = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setQueue(null); setDetail(null);
    const load = async () => {
      try {
        if (isDetail) { const data = await get<Ticket>(`tickets/${pathname.split("/").pop()}`, controller.signal); if (!data?.id || !data.category || !data.requester) throw new QueueError("FAILURE"); if (!controller.signal.aborted) setDetail(data); }
        else { const data = await get<Queue>(`tickets${search}`, controller.signal); if (!Array.isArray(data?.items) || !data.pagination) throw new QueueError("FAILURE"); if (!controller.signal.aborted) setQueue(data); }
      } catch (e) {
        if (controller.signal.aborted) return;
        const code = e instanceof QueueError ? e.code : "FAILURE";
        if (["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"].includes(code)) void refresh();
        setError(code);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load(); return () => controller.abort();
  }, [pathname, search, isDetail, revision, refresh]);
  useEffect(() => {
    const controller = new AbortController(); setOwnerError(false);
    get<{ items: Person[] }>("assignees", controller.signal).then(data => { if (!Array.isArray(data?.items)) throw new QueueError("FAILURE"); if (!controller.signal.aborted) setOwners(data.items); })
      .catch(() => { if (!controller.signal.aborted) setOwnerError(true); });
    return () => controller.abort();
  }, [ownerRevision]);
  const navigate = (path: string) => { window.history.pushState({}, "", path); setLocation(path); };
  const params = new URLSearchParams(search);
  const filtered = ["search", "status", "requestedPriority", "itPriority", "ownerId"].some(key => params.has(key));
  const reset = () => navigate("/staff/tickets");
  const select = (name: string, title: string, options: string[], fallback = "") => <label>{title}<select aria-label={title} name={name} defaultValue={params.get(name) ?? fallback}>
    {!fallback && <option value="">All</option>}{options.map(value => <option key={value} value={value}>{label(value)}</option>)}
  </select></label>;
  const page = (number: number) => { const next = new URLSearchParams(search); next.set("page", String(number)); navigate(`/staff/tickets?${next}`); };
  return <main id="main-content" tabIndex={-1} className="requester-page"><section className="requester-card staff-queue">
    <h1>{isDetail ? "Ticket Detail" : "Ticket Queue"}</h1>
    {isDetail ? <a href="/staff/tickets" onClick={e => { e.preventDefault(); reset(); }}>Back to Ticket Queue</a> : <>
      <p>Find, prioritize and open service requests.</p>
      <form key={search} className="staff-filters" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget), next = new URLSearchParams();
        for (const [key, value] of data) if (String(value).trim()) next.set(key, String(value).trim());
        next.set("page", "1"); navigate(`/staff/tickets?${next}`);
      }}><fieldset disabled={loading}>
        <label className="staff-search">Search<input name="search" defaultValue={params.get("search") ?? ""} placeholder="Ticket, summary, requester name or email" maxLength={120} /></label>
        {select("status", "Status", statuses)}{select("requestedPriority", "Requested Priority", priorities)}{select("itPriority", "IT Priority", priorities)}
        <label>Owner<select aria-label="Owner" name="ownerId" defaultValue={params.get("ownerId") ?? ""}><option value="">All</option><option value="me">Mine</option><option value="unassigned">Unassigned</option>
          {params.get("ownerId") && !["me", "unassigned"].includes(params.get("ownerId")!) && !owners.some(owner => String(owner.id) === params.get("ownerId")) && <option value={params.get("ownerId")!}>Selected owner #{params.get("ownerId")}</option>}
          {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.displayName} ({owner.email})</option>)}
        </select></label>
        {select("sortBy", "Sort by", ["updatedAt", "createdAt", "ticketNumber", "itPriority", "status"], "updatedAt")}
        {select("sortOrder", "Order", ["desc", "asc"], "desc")}
        <label>Page size<input type="number" name="pageSize" min={1} max={100} defaultValue={params.get("pageSize") ?? "20"} required /></label>
        <button type="submit">Apply filters</button><button type="button" onClick={reset}>Clear filters</button>
      </fieldset></form>
      {ownerError && <div role="alert">Owner choices could not be loaded. <button onClick={() => setOwnerRevision(n => n + 1)}>Retry owners</button></div>}
    </>}
    {loading && <p role="status">Loading tickets…</p>}
    {error && <div role="alert"><p>{error === "FORBIDDEN" ? "Forbidden: You do not have access to this screen." : error === "INVALID_QUERY" ? "Invalid queue query. Reset filters to continue." : error === "NOT_FOUND" ? "Ticket not found." : "Unable to load tickets. Try again."}</p>
      {error === "FORBIDDEN" ? <a href="/">Return to your home</a> : error === "INVALID_QUERY" ? <button onClick={reset}>Reset filters</button> : <button onClick={() => setRevision(n => n + 1)}>Retry</button>}</div>}
    {!loading && !error && detail && <article><h2>{detail.ticketNumber}: {detail.summary}</h2><TicketFields ticket={detail} /><h3>Description</h3><p className="staff-description">{detail.description}</p><p>Related system: {detail.relatedSystem?.name}</p></article>}
    {!loading && !error && queue && <>
      <p role="status">{queue.pagination.totalItems} tickets · Page {queue.pagination.page} of {queue.pagination.totalPages || 1}</p>
      {queue.items.length === 0 ? <p>{filtered ? "No results match your filters." : queue.pagination.totalItems ? "No tickets on this page. Return to an earlier page." : "No tickets yet."}</p> : <>
        <table className="staff-table"><caption className="visually-hidden">IT Staff tickets</caption><thead><tr><th>Ticket / Summary</th><th>Category / Requester</th><th>Requested / IT Priority</th><th>Status / Owner</th><th>Created / Updated</th><th>Action</th></tr></thead><tbody>{queue.items.map(ticket => <tr key={ticket.id}>
          <td><strong>{ticket.ticketNumber}</strong><br />{ticket.summary}</td><td>{ticket.category.name}<br />{ticket.requester.displayName}</td>
          <td><span className={`staff-badge priority-${ticket.requestedPriority.toLowerCase()}`}>{label(ticket.requestedPriority)}</span> / <span className={`staff-badge priority-${ticket.itPriority.toLowerCase()}`}>{label(ticket.itPriority)}</span></td>
          <td><span className="staff-badge">{label(ticket.status)}</span><br />{ticket.owner?.displayName ?? "Unassigned"}</td><td>{new Date(ticket.createdAt).toLocaleString()}<br />{new Date(ticket.updatedAt).toLocaleString()}</td>
          <td><a href={`/staff/tickets/${ticket.id}`} onClick={e => { e.preventDefault(); navigate(`/staff/tickets/${ticket.id}`); }}>View ticket<span className="visually-hidden"> {ticket.ticketNumber}</span></a></td>
        </tr>)}</tbody></table>
        <div className="staff-cards">{queue.items.map(ticket => <article key={ticket.id}><h2>{ticket.ticketNumber}</h2><p>{ticket.summary}</p><TicketFields ticket={ticket} />
          <a href={`/staff/tickets/${ticket.id}`} onClick={e => { e.preventDefault(); navigate(`/staff/tickets/${ticket.id}`); }}>View ticket<span className="visually-hidden"> {ticket.ticketNumber}</span></a></article>)}</div>
      </>}
      <nav aria-label="Queue pagination" className="staff-pagination"><button disabled={queue.pagination.page <= 1} onClick={() => page(queue.pagination.page - 1)}>Previous</button><button disabled={queue.pagination.page >= queue.pagination.totalPages} onClick={() => page(queue.pagination.page + 1)}>Next</button></nav>
    </>}
  </section></main>;
}
