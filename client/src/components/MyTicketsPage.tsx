import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getTicketMetadata,
  getTickets,
  type RequestedPriority,
  type TicketListQuery,
  type TicketListResponse,
  type TicketMetadata,
  type TicketSortField,
  type TicketSortOrder,
  type TicketSummary,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";

interface MyTicketsPageProps {
  initialSearch?: string;
  onCreateTicket: () => void;
}

const defaultQuery: TicketListQuery = {
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  pageSize: 10,
};
const emptyMetadata: TicketMetadata = { categories: [], relatedSystems: [] };

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function queryFromLocation(locationSearch = window.location.search): TicketListQuery {
  const parameters = new URLSearchParams(locationSearch);
  const priority = parameters.get("requestedPriority");
  const status = parameters.get("status");
  const sortBy = parameters.get("sortBy");
  const sortOrder = parameters.get("sortOrder");
  const pageSize = Number(parameters.get("pageSize"));
  const search = parameters.get("search")?.trim();
  return {
    ...(search ? { search } : {}),
    ...(status === "New" ? { status: "New" as const } : {}),
    ...(["LOW", "MEDIUM", "HIGH"].includes(priority ?? "")
      ? { requestedPriority: priority as RequestedPriority }
      : {}),
    ...(positiveInteger(parameters.get("categoryId"))
      ? { categoryId: positiveInteger(parameters.get("categoryId")) }
      : {}),
    ...(positiveInteger(parameters.get("relatedSystemId"))
      ? { relatedSystemId: positiveInteger(parameters.get("relatedSystemId")) }
      : {}),
    sortBy: (["createdAt", "ticketNumber", "summary"].includes(sortBy ?? "")
      ? sortBy
      : "createdAt") as TicketSortField,
    sortOrder: (sortOrder === "asc" ? "asc" : "desc") as TicketSortOrder,
    page: positiveInteger(parameters.get("page")) ?? 1,
    pageSize: ([10, 20, 50].includes(pageSize) ? pageSize : 10) as 10 | 20 | 50,
  };
}

function isDefaultQuery(query: TicketListQuery) {
  return (
    !query.search &&
    !query.status &&
    !query.requestedPriority &&
    !query.categoryId &&
    !query.relatedSystemId &&
    query.sortBy === "createdAt" &&
    query.sortOrder === "desc" &&
    query.page === 1 &&
    query.pageSize === 10
  );
}

function queryLocation(query: TicketListQuery): string {
  if (isDefaultQuery(query)) return "/tickets";
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("search", query.search);
  if (query.status) parameters.set("status", query.status);
  if (query.requestedPriority) parameters.set("requestedPriority", query.requestedPriority);
  if (query.categoryId) parameters.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId) parameters.set("relatedSystemId", String(query.relatedSystemId));
  if (query.sortBy !== "createdAt") parameters.set("sortBy", query.sortBy);
  if (query.sortOrder !== "desc") parameters.set("sortOrder", query.sortOrder);
  parameters.set("page", String(query.page));
  if (query.pageSize !== 10) parameters.set("pageSize", String(query.pageSize));
  return `/tickets?${parameters.toString()}`;
}

function displayPriority(priority: RequestedPriority) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function useMobileResults() {
  const [mobile, setMobile] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

export default function MyTicketsPage({ initialSearch = "", onCreateTicket }: MyTicketsPageProps) {
  const { currentRequester, requestAsCurrentRequester } = useRequester();
  const [query, setQuery] = useState(() => queryFromLocation(initialSearch));
  const [searchInput, setSearchInput] = useState(query.search ?? "");
  const [metadata, setMetadata] = useState<TicketMetadata>(emptyMetadata);
  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const latestRequest = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const isMobile = useMobileResults();

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    try {
      const nextResult = await getTickets(
        requestAsCurrentRequester,
        query,
        controller.signal,
      );
      if (requestId !== latestRequest.current) return;
      if (
        nextResult.items.length === 0 &&
        nextResult.pagination.totalPages > 0 &&
        query.page > nextResult.pagination.totalPages
      ) {
        const nextQuery = { ...query, page: nextResult.pagination.totalPages };
        window.history.replaceState({}, "", queryLocation(nextQuery));
        setQuery(nextQuery);
        return;
      }
      setResult(nextResult);
      setState("ready");
    } catch (error) {
      if (requestId !== latestRequest.current || (error instanceof Error && error.name === "AbortError")) return;
      setState("error");
    }
  }, [query, requestAsCurrentRequester]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      activeController.current?.abort();
      latestRequest.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void getTicketMetadata(controller.signal)
      .then(setMetadata)
      .catch(() => setMetadata(emptyMetadata));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const restore = () => {
      const restored = queryFromLocation();
      setState("loading");
      setResult(null);
      setQuery(restored);
      setSearchInput(restored.search ?? "");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function applyQuery(nextQuery: TicketListQuery, replace = false) {
    const nextLocation = queryLocation(nextQuery);
    window.history[replace ? "replaceState" : "pushState"]({}, "", nextLocation);
    setState("loading");
    setResult(null);
    setQuery(nextQuery);
  }

  function retryTickets() {
    setState("loading");
    setResult(null);
    void load();
  }

  function updateFilter(event: ChangeEvent<HTMLSelectElement>) {
    const { name, value } = event.target;
    let nextQuery: TicketListQuery = { ...query, page: 1 };
    if (name === "categoryId" || name === "relatedSystemId") {
      nextQuery = { ...nextQuery, [name]: value ? Number(value) : undefined };
    } else if (name === "pageSize") {
      nextQuery.pageSize = Number(value) as 10 | 20 | 50;
    } else if (name === "sort") {
      const [sortBy, sortOrder] = value.split(":") as [TicketSortField, TicketSortOrder];
      nextQuery.sortBy = sortBy;
      nextQuery.sortOrder = sortOrder;
    } else if (name === "requestedPriority") {
      nextQuery.requestedPriority = value ? (value as RequestedPriority) : undefined;
    } else if (name === "status") {
      nextQuery.status = value === "New" ? "New" : undefined;
    }
    applyQuery(nextQuery);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const search = searchInput.trim();
    applyQuery({ ...query, search: search || undefined, page: 1 });
  }

  function resetFilters() {
    setSearchInput("");
    applyQuery(defaultQuery);
  }

  const hasCriteria = Boolean(
    query.search ||
      query.status ||
      query.requestedPriority ||
      query.categoryId ||
      query.relatedSystemId,
  );
  const range = useMemo(() => {
    if (!result || result.pagination.totalItems === 0) return null;
    const start = (result.pagination.page - 1) * result.pagination.pageSize + 1;
    const end = start + result.items.length - 1;
    return { start, end, total: result.pagination.totalItems };
  }, [result]);

  if (!currentRequester) return null;

  return (
    <main className="my-tickets-page" id="main-content" tabIndex={-1}>
      <div className="my-tickets-heading">
        <div>
          <p className="eyebrow">Requester workspace</p>
          <h1>My Tickets</h1>
          <p>Tickets owned by {currentRequester.displayName}</p>
        </div>
        <button className="zen-button" type="button" onClick={onCreateTicket}>
          Create ticket
        </button>
      </div>

      <section className="ticket-query-panel" aria-label="Ticket search and filters">
        <form className="ticket-search" role="search" onSubmit={submitSearch}>
          <label htmlFor="ticket-search">Search tickets</label>
          <div>
            <input
              id="ticket-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button className="zen-button" type="submit">Search</button>
            {query.search && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSearchInput("");
                  applyQuery({ ...query, search: undefined, page: 1 });
                }}
              >
                Clear search
              </button>
            )}
          </div>
        </form>

        <div className="ticket-filters">
          <Filter label="Category" name="categoryId" value={String(query.categoryId ?? "")} onChange={updateFilter}>
            <option value="">All categories</option>
            {metadata.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Filter>
          <Filter label="Related System" name="relatedSystemId" value={String(query.relatedSystemId ?? "")} onChange={updateFilter}>
            <option value="">All systems</option>
            {metadata.relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </Filter>
          <Filter label="Requested Priority" name="requestedPriority" value={query.requestedPriority ?? ""} onChange={updateFilter}>
            <option value="">All priorities</option>
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </Filter>
          <Filter label="Status" name="status" value={query.status ?? ""} onChange={updateFilter}>
            <option value="">All statuses</option><option value="New">New</option>
          </Filter>
          <Filter label="Sort" name="sort" value={`${query.sortBy}:${query.sortOrder}`} onChange={updateFilter}>
            <option value="createdAt:desc">Newest first</option><option value="createdAt:asc">Oldest first</option>
            <option value="ticketNumber:asc">Ticket number A–Z</option><option value="ticketNumber:desc">Ticket number Z–A</option>
            <option value="summary:asc">Summary A–Z</option><option value="summary:desc">Summary Z–A</option>
          </Filter>
          <Filter label="Tickets per page" name="pageSize" value={String(query.pageSize)} onChange={updateFilter}>
            <option value="10">10</option><option value="20">20</option><option value="50">50</option>
          </Filter>
        </div>
        <button className="secondary-button reset-filters" type="button" onClick={resetFilters}>Reset filters</button>
      </section>

      <section className="ticket-results" aria-live="polite" aria-busy={state === "loading"}>
        {state === "loading" && <div className="ticket-list-state" role="status"><span className="requester-spinner" aria-hidden="true" />Loading tickets…</div>}
        {state === "error" && <div className="ticket-list-state ticket-list-error" role="alert"><p>We couldn&apos;t load your tickets.</p><button className="zen-button" type="button" onClick={retryTickets}>Retry</button></div>}
        {state === "ready" && result?.pagination.totalItems === 0 && !hasCriteria && <EmptyState title="No tickets yet" action="Create your first ticket" onAction={onCreateTicket} />}
        {state === "ready" && result?.pagination.totalItems === 0 && hasCriteria && <EmptyState title="No tickets match your search or filters" action="Reset filters" onAction={resetFilters} />}
        {state === "ready" && result && result.items.length > 0 && (
          <>
            {range && <p className="ticket-result-summary">Showing {range.start}–{range.end} of {range.total} tickets</p>}
            {isMobile ? <TicketCards tickets={result.items} /> : <TicketTable requesterName={currentRequester.displayName} tickets={result.items} sortBy={query.sortBy} sortOrder={query.sortOrder} />}
            <Pagination page={result.pagination.page} totalPages={result.pagination.totalPages} onPage={(page) => applyQuery({ ...query, page })} />
          </>
        )}
      </section>
    </main>
  );
}

function Filter({ label, name, value, onChange, children }: { label: string; name: string; value: string; onChange: (event: ChangeEvent<HTMLSelectElement>) => void; children: ReactNode }) {
  const id = `ticket-filter-${name}`;
  return <div className="ticket-filter"><label htmlFor={id}>{label}</label><select id={id} name={name} value={value} onChange={onChange}>{children}</select></div>;
}

function EmptyState({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <div className="ticket-list-state"><h2>{title}</h2><button className="zen-button" type="button" onClick={onAction}>{action}</button></div>;
}

function TicketTable({ requesterName, tickets, sortBy, sortOrder }: { requesterName: string; tickets: TicketSummary[]; sortBy: TicketSortField; sortOrder: TicketSortOrder }) {
  const sort = (field: TicketSortField) => sortBy === field ? (sortOrder === "asc" ? "ascending" : "descending") : "none";
  return <div className="ticket-table-region" role="region" aria-label="Ticket results — scroll horizontally for more columns" tabIndex={0}><table><caption>Tickets owned by {requesterName}</caption><thead><tr><th aria-sort={sort("ticketNumber")}>Ticket Number</th><th aria-sort={sort("summary")}>Summary</th><th>Category</th><th>Related System</th><th>Requested Priority</th><th>Status</th><th aria-sort={sort("createdAt")}>Created</th><th>Action</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><a href={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</a></td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{ticket.relatedSystem.name}</td><td><span className={`priority-badge priority-${ticket.requestedPriority.toLowerCase()}`}>{displayPriority(ticket.requestedPriority)}</span></td><td><span className="status-badge">New</span></td><td><time dateTime={ticket.createdAt}>{displayDate(ticket.createdAt)}</time></td><td><a href={`/tickets/${ticket.id}`} aria-label={`View details for ${ticket.ticketNumber}`}>View details</a></td></tr>)}</tbody></table></div>;
}

function TicketCards({ tickets }: { tickets: TicketSummary[] }) {
  return <div className="ticket-card-list">{tickets.map((ticket) => <article className="ticket-card" key={ticket.id}><a className="ticket-card-number" href={`/tickets/${ticket.id}`}>{ticket.ticketNumber}</a><h2>{ticket.summary}</h2><dl><div><dt>Category</dt><dd>{ticket.category.name}</dd></div><div><dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd></div><div><dt>Requested Priority</dt><dd>{displayPriority(ticket.requestedPriority)}</dd></div><div><dt>Status</dt><dd>New</dd></div><div><dt>Created</dt><dd><time dateTime={ticket.createdAt}>{displayDate(ticket.createdAt)}</time></dd></div></dl><a className="zen-button ticket-card-action" href={`/tickets/${ticket.id}`} aria-label={`View details for ${ticket.ticketNumber}`}>View details</a></article>)}</div>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav className="ticket-pagination" aria-label="Ticket pages"><button type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={number === page ? "page" : undefined} onClick={() => onPage(number)}>{number}</button>)}<button type="button" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next</button></nav>;
}
