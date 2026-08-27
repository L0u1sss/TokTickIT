import { FormEvent, useEffect, useRef, useState } from "react";
import { useRequester } from "../context/RequesterContext.js";

export default function RequesterSelection() {
  const { requesters, loading, error, fetchRequesters, commitRequester } = useRequester();
  const [selectedRequesterId, setSelectedRequesterId] = useState("");
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  const selectedId = Number(selectedRequesterId);
  const hasValidSelection =
    /^\d+$/.test(selectedRequesterId) &&
    Number.isSafeInteger(selectedId) &&
    selectedId > 0 &&
    requesters.some(({ id }) => id === selectedId);

  useEffect(() => {
    if (error) {
      retryButtonRef.current?.focus();
    }
  }, [error]);

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasValidSelection) {
      commitRequester(selectedId);
    }
  }

  function reloadRequesters() {
    setSelectedRequesterId("");
    void fetchRequesters();
  }

  return (
    <main className="requester-page">
      <section className="requester-card" aria-labelledby="requester-title">
        <div className="brand-mark" aria-hidden="true">
          T
        </div>
        <p className="eyebrow">TokTickIT Service Desk</p>
        <h1 id="requester-title">Select a Development Requester</h1>
        <p className="selection-intro">
          Choose a seeded requester, then continue to the requester application.
        </p>

        <p className="demo-disclaimer" role="note">
          <strong>Demo context — not secure authentication.</strong> This selection is only for
          Lab 2 development and testing.
        </p>

        {loading && (
          <div className="state-panel" role="status" aria-live="polite">
            <span className="requester-spinner" aria-hidden="true" />
            <span>Loading requesters…</span>
          </div>
        )}

        {!loading && error && (
          <div className="state-panel state-panel-error" role="alert">
            <p>We couldn&apos;t load requesters.</p>
            <button
              ref={retryButtonRef}
              className="zen-button"
              type="button"
              onClick={reloadRequesters}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && requesters.length === 0 && (
          <div className="state-panel" role="status" aria-live="polite">
            <p>No active requesters are available.</p>
            <button className="zen-button" type="button" onClick={reloadRequesters}>
              Refresh
            </button>
          </div>
        )}

        {!error && (loading || requesters.length > 0) && (
          <form className="requester-form" aria-busy={loading} onSubmit={handleContinue}>
            <div className="requester-field">
              <label className="requester-label" htmlFor="development-requester">
                Development Requester
              </label>
              <select
                id="development-requester"
                className="requester-select"
                value={hasValidSelection ? selectedRequesterId : ""}
                disabled={loading}
                onChange={(event) => setSelectedRequesterId(event.target.value)}
              >
                <option value="">{loading ? "Loading requesters…" : "Select a requester"}</option>
                {requesters.map(({ id, displayName, email }) => (
                  <option key={id} value={id}>
                    {displayName} — {email}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="zen-button continue-button"
              type="submit"
              disabled={loading || !hasValidSelection}
            >
              Continue
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
