import { useEffect } from "react";
import AppHeader from "./components/AppHeader.js";
import CreateTicketPage from "./components/CreateTicketPage.js";
import RequesterSelection from "./components/RequesterSelection.js";
import { useRequester } from "./context/RequesterContext.js";

export const CREATE_TICKET_PATH = "/tickets/new";
export const REQUESTER_SELECTION_PATH = "/requester-selection";

function enterCreateTicketRoute() {
  if (window.location.pathname !== CREATE_TICKET_PATH) {
    window.history.replaceState({}, "", CREATE_TICKET_PATH);
  }
}

function enterRequesterSelectionRoute() {
  if (window.location.pathname !== REQUESTER_SELECTION_PATH) {
    window.history.replaceState({}, "", REQUESTER_SELECTION_PATH);
  }
}

export default function App() {
  const { currentRequester } = useRequester();

  if (!currentRequester) {
    return <RequesterGate />;
  }

  return <RequesterApplication key={currentRequester.id} />;
}

function RequesterGate() {
  useEffect(() => {
    enterRequesterSelectionRoute();
  }, []);

  return <RequesterSelection onContinue={enterCreateTicketRoute} />;
}

function RequesterApplication() {
  useEffect(() => {
    enterCreateTicketRoute();
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />
      <CreateTicketPage />
    </div>
  );
}
