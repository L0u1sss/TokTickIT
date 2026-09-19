import { useEffect, useRef, useState } from "react";
import { fetchAuthenticated } from "../api.js";

type Entry = { id: number; content: string; createdAt: string; author: { displayName: string; role: string } };
export function CommunicationSection({ ticketId, staff = false, internal = false }: { ticketId: number; staff?: boolean; internal?: boolean }) {
  const path = `/api/${staff ? "staff/" : ""}tickets/${ticketId}/${internal ? "internal-notes" : "comments"}`;
  const title = internal ? "Internal Note" : "Public Comment";
  const [items, setItems] = useState<Entry[]>([]), [content, setContent] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(""); } });
    fetchAuthenticated(path, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.items) || !data.items.every((item: Entry) => item && typeof item.content === "string" && typeof item.author?.displayName === "string" && typeof item.createdAt === "string")) throw new Error();
      if (!controller.signal.aborted) setItems(data.items);
    }).catch(() => { if (!controller.signal.aborted) setError("Unable to load entries. Please retry."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  const count = Array.from(content.trim()).length;
  async function post() {
    if (lock.current) return;
    if (!count || count > 2000) { setError("Enter 1–2,000 characters."); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const token = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("toktickit_csrf="))?.slice("toktickit_csrf=".length);
      const response = await fetchAuthenticated(path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "X-CSRF-Token": token } : {}) }, body: JSON.stringify({ content: content.trim() }) });
      if (!response.ok) throw new Error();
      const entry = await response.json() as Entry;
      setItems(previous => [...previous, entry]); setContent(""); setNotice(`${title} posted.`);
    } catch { setError("Unable to post. Your draft has been kept. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={`communication-section ${internal ? "communication-internal" : "communication-public"}`} aria-label={`${title}s`}>
    <h3>{title}s</h3><p>{internal ? "Private — visible only to IT Staff and Administrator." : "Shared with the Requester, IT Staff and Administrator."} Entries cannot be edited or deleted.</p>
    {loading && <p role="status">Loading entries…</p>}
    {error && <p role="alert">{error} <button className="zen-button secondary-button" type="button" onClick={() => setRevision(v => v + 1)}>Reload entries</button></p>}
    {!loading && !error && items.length === 0 && <p>No entries yet.</p>}
    {items.map(item => <article key={item.id}><strong>{item.author.displayName}</strong> <span>{item.author.role}</span> <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time><p className="communication-content">{item.content}</p></article>)}
    <form onSubmit={event => { event.preventDefault(); void post(); }}>
      <label>{title}<textarea aria-label={title} value={content} disabled={busy} onChange={event => setContent(event.target.value)} /></label>
      <p>{count}/2,000 characters</p><button className="zen-button" type="submit" disabled={busy || loading}>{busy ? "Posting…" : internal ? "Add Internal Note" : "Post Public Comment"}</button>
    </form>{notice && <p role="status">{notice}</p>}
  </section>;
}

export function ResolutionIndication({ ticketId, status, initialAt }: { ticketId: number; status: string; initialAt?: string | null }) {
  const [at, setAt] = useState(initialAt), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function indicate() {
    if (!window.confirm("Tell IT Staff the problem appears resolved? IT Staff remain responsible for resolving or closing this Ticket.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetchAuthenticated(`/api/tickets/${ticketId}/problem-appears-resolved`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      setAt((await response.json()).problemAppearsResolvedAt);
    } catch { setError("Unable to record the indication. Refresh the Ticket and try again."); }
    finally { setBusy(false); }
  }
  return <section className="communication-section" aria-label="Resolution indication"><h3>Problem Appears Resolved</h3>
    <p>This informs IT Staff; the Ticket status stays unchanged.</p>
    {at ? <p role="status">Reported at {new Date(at).toLocaleString()}</p> : ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(status.toUpperCase().replaceAll(" ", "_")) && <button className="zen-button" disabled={busy} onClick={() => void indicate()}>Problem Appears Resolved</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
