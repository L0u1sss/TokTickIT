import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { getRequesterDashboard, type RequesterDashboardData, type TicketSummary } from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function RequesterDashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { currentRequester, requestAsCurrentRequester } = useRequester();
  const [data, setData] = useState<RequesterDashboardData | null>(null), [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading"); setData(null);
    try {
      const next = await getRequesterDashboard(requestAsCurrentRequester, signal);
      if (!Number.isInteger(next?.metrics?.openCount) || !Number.isInteger(next?.metrics?.waitingForRequesterCount) || !Array.isArray(next?.recentlyUpdated) || !Array.isArray(next?.recentlyResolved)) throw new Error("Invalid dashboard response");
      setData(next); setState("ready");
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setState("error"); }
  }, [requestAsCurrentRequester]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);
  if (!currentRequester) return null;
  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => { event.preventDefault(); onNavigate(path); };
  return <main className="dashboard-page" id="main-content" tabIndex={-1}>
    <header className="dashboard-heading"><div><p className="eyebrow">Requester workspace</p><h1>Dashboard</h1><p>Ticket overview for {currentRequester.displayName}</p></div>
      {data && <p>Last refreshed <time dateTime={data.generatedAt}>{displayDate(data.generatedAt)}</time></p>}</header>
    {state === "loading" && <section className="dashboard-loading" aria-label="Loading dashboard" role="status"><div /><div /><p>Loading dashboard…</p></section>}
    {state === "error" && <div className="dashboard-error" role="alert"><p>We couldn&apos;t load your dashboard. Try again.</p><button className="zen-button" type="button" onClick={() => void load()}>Retry</button></div>}
    {state === "ready" && data && <>
      <section className="dashboard-metrics" aria-label="Ticket metrics">
        <a className="dashboard-metric" href="/tickets?status=OPEN_GROUP" onClick={event => navigate(event, "/tickets?status=OPEN_GROUP")}><span>Open Tickets</span><strong>{data.metrics.openCount}</strong><span>View open tickets</span></a>
        <a className="dashboard-metric" href="/tickets?status=WAITING_FOR_REQUESTER" onClick={event => navigate(event, "/tickets?status=WAITING_FOR_REQUESTER")}><span>Waiting for You</span><strong>{data.metrics.waitingForRequesterCount}</strong><span>View tickets waiting for you</span></a>
      </section>
      {data.metrics.openCount === 0 && data.recentlyUpdated.length === 0 && <section className="dashboard-zero"><h2>No Tickets yet</h2><p>Create a Ticket when you need help from the IT team.</p><a className="zen-button" href="/tickets/new" onClick={event => navigate(event, "/tickets/new")}>Create Ticket</a></section>}
      <div className="dashboard-lists"><DashboardList title="Recently Updated" empty="No recently updated Tickets." tickets={data.recentlyUpdated} onNavigate={onNavigate} /><DashboardList title="Recently Resolved" empty="No resolved Tickets yet." tickets={data.recentlyResolved} onNavigate={onNavigate} /></div>
    </>}
  </main>;
}

function DashboardList({ title, empty, tickets, onNavigate }: { title: string; empty: string; tickets: TicketSummary[]; onNavigate: (path: string) => void }) {
  return <section className="dashboard-list"><h2>{title}</h2>{tickets.length === 0 ? <p>{empty}</p> : <ul>{tickets.map(ticket => <li key={ticket.id}><a href={`/tickets/${ticket.id}`} onClick={event => { event.preventDefault(); onNavigate(`/tickets/${ticket.id}`); }}><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span><span>{ticket.status} · Updated <time dateTime={ticket.updatedAt}>{displayDate(ticket.updatedAt)}</time></span></a></li>)}</ul>}</section>;
}
