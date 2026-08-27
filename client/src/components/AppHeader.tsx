import { useRequester } from "../context/RequesterContext.js";

export default function AppHeader() {
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
            className="app-navigation-link active"
            href="/tickets/new"
            aria-current="page"
          >
            Create Ticket
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
