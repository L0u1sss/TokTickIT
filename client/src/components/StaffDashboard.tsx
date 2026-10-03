import { useCallback, useEffect, useState } from "react";
import { ApiResponseError, getStaffDashboard, type StaffDashboardAction, type StaffDashboardData, type StaffDashboardTicket } from "../api.js";
import { useAuth } from "../context/AuthContext.js";

const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function StaffDashboard() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading"); setData(null);
    try {
      const next = await getStaffDashboard(signal);
      if (signal?.aborted) return;
      if (!next?.metrics || !Array.isArray(next.myActions) || !Array.isArray(next.recentlyUpdated) || !Array.isArray(next.urgentTickets)) throw new Error("Invalid dashboard response");
      setData(next); setState("ready");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (signal?.aborted) return;
      if (error instanceof ApiResponseError && ["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"].includes(error.code)) void refresh();
      setState(error instanceof ApiResponseError && error.code === "FORBIDDEN" ? "forbidden" : "error");
    }
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  return <main className="dashboard-page" id="main-content" tabIndex={-1}>
    <header className="dashboard-heading"><div><p className="eyebrow">Operational workspace</p><h1>Dashboard</h1><p>Service desk overview for {user?.displayName}</p></div>
      {data && <p>Last refreshed <time dateTime={data.generatedAt}>{displayDate(data.generatedAt)}</time></p>}</header>
    {state === "loading" && <section className="dashboard-loading" aria-label="Loading staff dashboard" role="status"><div /><div /><p>Loading dashboard...</p></section>}
    {state === "error" && <div className="dashboard-error" role="alert"><p>We couldn&apos;t load the operational dashboard. Try again.</p><button className="zen-button" type="button" onClick={() => void load()}>Retry</button></div>}
    {state === "forbidden" && <div className="dashboard-error" role="alert"><h2>Forbidden</h2><p>You do not have access to the operational dashboard.</p></div>}
    {state === "ready" && data && <>
      <section className="dashboard-metrics" aria-label="Operational metrics">
        <Metric href="/staff/tickets?ownerId=unassigned&status=OPEN_GROUP" title="Unassigned Open" count={data.metrics.unassignedOpenCount} />
        <Metric href="/staff/tickets?ownerId=me&status=OPEN_GROUP" title="Owned by Me" count={data.metrics.ownedByMeOpenCount} />
      </section>
      <div className="staff-dashboard-groups">
        <MetricGroup title="Tickets by Status" items={statuses.map(status => ({ label: label(status), count: data.metrics.byStatus[status], href: `/staff/tickets?status=${status}` }))} />
        <MetricGroup title="Tickets by IT Priority" items={priorities.map(priority => ({ label: label(priority), count: data.metrics.byItPriority[priority], href: `/staff/tickets?itPriority=${priority}` }))} />
      </div>
      <div className="dashboard-lists">
        <TicketList title="Recently Updated Open Tickets" empty="No open Tickets." tickets={data.recentlyUpdated} />
        <TicketList title="High Priority Tickets" empty="No high-priority Tickets." tickets={data.urgentTickets} />
      </div>
      <ActionList actions={data.myActions} />
    </>}
  </main>;
}

function Metric({ href, title, count }: { href: string; title: string; count: number }) {
  return <a className="dashboard-metric" href={href}><span>{title}</span><strong>{count}</strong><span>Open filtered Ticket Queue</span></a>;
}
function MetricGroup({ title, items }: { title: string; items: Array<{ label: string; count: number; href: string }> }) {
  return <section className="dashboard-list"><h2>{title}</h2><ul className="staff-dashboard-counts">{items.map(item => <li key={item.href}><a href={item.href}><span>{item.label}</span><strong>{item.count}</strong></a></li>)}</ul></section>;
}
function TicketList({ title, empty, tickets }: { title: string; empty: string; tickets: StaffDashboardTicket[] }) {
  return <section className="dashboard-list"><h2>{title}</h2>{tickets.length === 0 ? <p>{empty}</p> : <ul>{tickets.map(ticket => <li key={ticket.id}><a href={`/staff/tickets/${ticket.id}`}><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span><span>{label(ticket.status)} · {label(ticket.itPriority)} · <time dateTime={ticket.updatedAt}>{displayDate(ticket.updatedAt)}</time></span></a></li>)}</ul>}</section>;
}
function ActionList({ actions }: { actions: StaffDashboardAction[] }) {
  return <section className="dashboard-list staff-dashboard-actions"><h2>My Actions</h2>{actions.length === 0 ? <p>No Actions recorded by, assigned to, or performed by you.</p> : <ul>{actions.map(action => <li key={action.id}><a href={`/staff/tickets/${action.ticketId}#actions`}><strong>{action.ticketNumber} · {label(action.status)}</strong><span>{action.description}</span><span>{action.attribution.map(label).join(" · ")}</span><span>{action.ticketSummary} · Updated <time dateTime={action.updatedAt}>{displayDate(action.updatedAt)}</time></span></a></li>)}</ul>}</section>;
}
