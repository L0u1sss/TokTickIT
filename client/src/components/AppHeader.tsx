import { useRequester } from "../context/RequesterContext.js";

interface AppHeaderProps {
  activePath: "/tickets" | "/tickets/new";
  onNavigate: (path: "/tickets" | "/tickets/new") => void;
}

export default function AppHeader({ activePath, onNavigate }: AppHeaderProps) {
  const { currentRequester, changeRequester } = useRequester();

  if (!currentRequester) {
    return null;
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            T
          </span>
          <span>
            TokTickIT <strong>IT Service Desk</strong>
          </span>
        </div>
        <nav className="app-navigation" aria-label="Ticket navigation">
          <a
            className={`app-navigation-link${activePath === "/tickets/new" ? " active" : ""}`}
            href="/tickets/new"
            aria-current={activePath === "/tickets/new" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/tickets/new");
            }}
          >
            Create Ticket
          </a>
          <a
            className={`app-navigation-link${activePath === "/tickets" ? " active" : ""}`}
            href="/tickets"
            aria-current={activePath === "/tickets" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/tickets");
            }}
          >
            My Tickets
          </a>
        </nav>
        <div className="requester-menu">
          <span className="context-disclaimer">Demo context</span>
          <span className="current-requester">
            <span className="current-requester-label">Viewing as</span>
            <strong>{currentRequester.displayName}</strong>
          </span>
          <button
            className="switch-requester-button"
            type="button"
            onClick={changeRequester}
          >
            Change Requester
          </button>
        </div>
      </div>
    </header>
  );
}
