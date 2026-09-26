import { useCallback, useEffect, useState } from "react";
import AppHeader from "./components/AppHeader.js";
import CreateTicketPage from "./components/CreateTicketPage.js";
import MyTicketsPage from "./components/MyTicketsPage.js";
import TicketDetailPage from "./components/TicketDetailPage.js";
import RequesterDashboard from "./components/RequesterDashboard.js";
import { useRequester } from "./context/RequesterContext.js";

export const CREATE_TICKET_PATH = "/tickets/new";
export const MY_TICKETS_PATH = "/tickets";
export const REQUESTER_SELECTION_PATH = "/requester-selection";
export const DASHBOARD_PATH = "/dashboard";

function isTicketDetailPath(path: string) {
  return /^\/tickets\/[^/]+$/.test(path) && path !== CREATE_TICKET_PATH;
}

export default function App() {
  const { currentRequester } = useRequester();
  if (!currentRequester) return null;
  return <RequesterApplication key={currentRequester.id} intendedPath={DASHBOARD_PATH} />;
}

function RequesterApplication({ intendedPath }: { intendedPath: string }) {
  const initialPath = window.location.pathname === REQUESTER_SELECTION_PATH
    ? intendedPath
    : `${window.location.pathname}${window.location.search}`;
  const initialPathname = initialPath.split("?")[0];
  const [location, setLocation] = useState(
    initialPathname === DASHBOARD_PATH || initialPathname === CREATE_TICKET_PATH || initialPathname === MY_TICKETS_PATH || isTicketDetailPath(initialPathname)
      ? initialPath
      : DASHBOARD_PATH,
  );

  useEffect(() => {
    if (`${window.location.pathname}${window.location.search}` !== location) {
      window.history.replaceState({}, "", location);
    }
    const restore = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [location]);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setLocation(path);
  }, []);

  const pathname = location.split("?")[0];
  const activePath = pathname === DASHBOARD_PATH ? DASHBOARD_PATH : pathname === MY_TICKETS_PATH || isTicketDetailPath(pathname)
    ? MY_TICKETS_PATH
    : CREATE_TICKET_PATH;

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <AppHeader activePath={activePath} onNavigate={navigate} />
      {pathname === DASHBOARD_PATH ? <RequesterDashboard onNavigate={navigate} /> : isTicketDetailPath(pathname) ? (
        <TicketDetailPage
          ticketIdSegment={pathname.slice("/tickets/".length)}
          onBack={() => navigate(MY_TICKETS_PATH)}
        />
      ) : activePath === MY_TICKETS_PATH ? (
        <MyTicketsPage
          initialSearch={location.includes("?") ? location.slice(location.indexOf("?")) : ""}
          onCreateTicket={() => navigate(CREATE_TICKET_PATH)}
        />
      ) : (
        <CreateTicketPage
          onCancel={() => navigate(MY_TICKETS_PATH)}
          onViewTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
        />
      )}
    </div>
  );
}
