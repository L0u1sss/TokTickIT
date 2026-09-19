import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminRequest, type ManagedUser } from "../admin-api.js";
import { AuthError } from "../auth-api.js";
import { useAuth } from "../context/AuthContext.js";

const roles = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
const roleName = (role: string) => ({ REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" })[role] ?? role;
const passwordRules = "Use 12–128 characters, no leading/trailing whitespace, and at least three of lowercase, uppercase, numbers and symbols.";
type Editor = { kind: "create" } | { kind: "edit" | "password"; user: ManagedUser };

export default function UserManagement() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const reload = () => { setLoading(true); setError(""); setItems([]); setRevision(value => value + 1); };
  useEffect(() => {
    const controller = new AbortController();
    void adminRequest<{ items: ManagedUser[] }>(`users${query ? `?${query}` : ""}`, "GET", undefined, controller.signal)
      .then(data => {
        if (!Array.isArray(data.items)) throw new Error("Invalid user list response.");
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        if (failure instanceof AuthError && (failure.status === 401 || failure.code === "PASSWORD_CHANGE_REQUIRED")) { void refresh(); return; }
        if (failure instanceof AuthError && failure.status === 403) { setForbidden(true); return; }
        setError("Unable to load users. Try again.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, refresh]);
  const open = (next: Editor) => { trigger.current = document.activeElement as HTMLElement; setNotice(""); setEditor(next); };
  const close = () => { setEditor(null); window.setTimeout(() => {
    if (trigger.current?.isConnected) trigger.current.focus();
    else document.getElementById("admin-create-user")?.focus();
  }, 0); };
  const filter = (event: FormEvent) => {
    event.preventDefault(); const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (role) params.set("role", role);
    setQuery(params.toString()); reload();
  };
  if (forbidden || user?.role !== "ADMINISTRATOR") return <main className="requester-page"><h1>Forbidden</h1><p>Administrator access is required.</p></main>;
  return <main id="main-content" tabIndex={-1} className="requester-page admin-users">
    <section className="requester-card">
      <div className="admin-toolbar"><div><h1>User Management</h1><p>Manage accounts, roles and access.</p></div><button id="admin-create-user" className="btn btn-primary" onClick={() => open({ kind: "create" })}>Create user</button></div>
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={filter} className="admin-toolbar admin-filters">
        <label>Search name or email<input className="form-control" type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Filter by role<select className="form-select" value={role} onChange={event => setRole(event.target.value)}><option value="">All roles</option>{roles.map(value => <option key={value} value={value}>{roleName(value)}</option>)}</select></label>
        <button className="btn btn-primary" disabled={loading}>Search</button>
        <button className="btn btn-outline-secondary" type="button" onClick={() => { setSearch(""); setRole(""); setQuery(""); reload(); }}>Clear filters</button>
      </form>
      {loading ? <p role="status">Loading users…</p> : error ? <div role="alert">{error} <button className="btn btn-outline-secondary" onClick={reload}>Retry</button></div> : items.length === 0 ? <p role="status">{query ? "No users match these filters." : "No users yet."}</p> : <>
        <table className="table admin-table"><caption>{items.length} user accounts</caption><thead><tr>{["Name", "Email", "Role", "Status", "Action"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{items.map(account => <tr key={account.id}><th scope="row">{account.displayName}</th><td>{account.email}</td><td>{roleName(account.role)}</td><td>{account.isActive ? "Active" : "Inactive"}</td><td><button className="btn btn-outline-secondary" aria-label={`Edit ${account.displayName}`} onClick={() => open({ kind: "edit", user: account })}>Edit</button></td></tr>)}</tbody></table>
        <ul className="admin-cards">{items.map(account => <li key={account.id}><h2>{account.displayName}</h2><dl><dt>Email</dt><dd>{account.email}</dd><dt>Role</dt><dd>{roleName(account.role)}</dd><dt>Status</dt><dd>{account.isActive ? "Active" : "Inactive"}</dd></dl><button className="btn btn-outline-secondary" aria-label={`Edit ${account.displayName}`} onClick={() => open({ kind: "edit", user: account })}>Edit</button></li>)}</ul>
      </>}
    </section>
    {editor && <UserEditor key={`${editor.kind}-${"user" in editor ? editor.user.id : "new"}`} editor={editor} actorId={user.id} onClose={close} onPassword={account => setEditor({ kind: "password", user: account })} onSaved={async account => {
      close(); setNotice(editor.kind === "password" ? "Initial password updated. The user must change it at next login." : "User saved.");
      if (account.id === user.id) await refresh();
      else reload();
    }} onAccessLost={() => { close(); setItems([]); void refresh(); }} />}
  </main>;
}

function UserEditor({ editor, actorId, onClose, onPassword, onSaved, onAccessLost }: { editor: Editor; actorId: number; onClose: () => void; onPassword: (user: ManagedUser) => void; onSaved: (user: ManagedUser) => Promise<void>; onAccessLost: () => void }) {
  const account = "user" in editor ? editor.user : undefined;
  const [name, setName] = useState(account?.displayName ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [role, setRole] = useState(account?.role ?? "REQUESTER");
  const [active, setActive] = useState(account?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending.current) return;
    const invalid: Record<string, string> = {};
    if (editor.kind !== "password") {
      if (!name.trim() || Array.from(name.trim()).length > 120) invalid.displayName = "Enter a name of 1–120 characters.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || Array.from(email.trim()).length > 254) invalid.email = "Enter a valid email address.";
    }
    if (editor.kind !== "edit" && (Array.from(password).length < 12 || Array.from(password).length > 128 || password.trim() !== password || [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{N}\s]/u].filter(rule => rule.test(password)).length < 3)) invalid.initialPassword = passwordRules;
    if (editor.kind === "password" && password !== confirmation) invalid.confirmPassword = "Passwords must match.";
    setFields(invalid);
    if (Object.keys(invalid).length) { setError("Check the highlighted fields."); errorSummary.current?.focus(); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const result = editor.kind === "password"
        ? (await adminRequest<{ user: ManagedUser }>(`users/${account!.id}/initial-password`, "POST", { initialPassword: password })).user
        : await adminRequest<ManagedUser>(account ? `users/${account.id}` : "users", account ? "PATCH" : "POST", { displayName: name, email, role, isActive: active, ...(account ? {} : { initialPassword: password }) });
      setPassword(""); setConfirmation(""); await onSaved(result);
    } catch (failure) {
      setPassword(""); setConfirmation("");
      if (failure instanceof AuthError) {
        if (failure.status === 401 || failure.code === "PASSWORD_CHANGE_REQUIRED" || failure.code === "FORBIDDEN") { onAccessLost(); return; }
        setError(failure.message); setFields(failure.fieldErrors);
        if (failure.code === "LAST_ACTIVE_ADMIN_REQUIRED") window.setTimeout(() => document.getElementById("admin-role")?.focus(), 0);
      } else setError("The request could not be completed. Try again.");
    } finally { pending.current = false; setBusy(false); }
  };
  const fieldError = (field: string) => fields[field] ? <p className="text-danger" id={`error-${field}`}>{fields[field]}</p> : null;
  const title = editor.kind === "create" ? "Create user" : editor.kind === "edit" ? "Edit user" : "Set new initial password";
  return <dialog className="admin-dialog" ref={dialog} aria-labelledby="admin-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(element => !element.matches(":disabled"));
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <h2 id="admin-editor-title">{title}</h2>
      {account && <p>{account.displayName} — {account.email}</p>}
      {error && <div role="alert" tabIndex={-1} ref={errorSummary}><p>{error}</p><ul>{Object.entries(fields).map(([field, message]) => <li key={field}><a href={`#admin-${field}`} onClick={event => { event.preventDefault(); document.getElementById(`admin-${field}`)?.focus(); }}>{message}</a></li>)}</ul></div>}
      <fieldset disabled={busy}>
        {editor.kind !== "password" && <>
          <label htmlFor="admin-displayName">Name</label><input autoFocus id="admin-displayName" className="form-control" value={name} onChange={event => setName(event.target.value)} maxLength={120} required aria-invalid={!!fields.displayName} aria-describedby={fields.displayName ? "error-displayName" : undefined} />{fieldError("displayName")}
          <label htmlFor="admin-email">Email</label><input id="admin-email" className="form-control" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required aria-invalid={!!fields.email} aria-describedby={fields.email ? "error-email" : undefined} />{fieldError("email")}
          <label htmlFor="admin-role">Role</label><select id="admin-role" className="form-select" value={role} onChange={event => setRole(event.target.value as ManagedUser["role"])}>{roles.map(value => <option key={value} value={value}>{roleName(value)}</option>)}</select>{fieldError("role")}
          <label className="admin-active"><input type="checkbox" checked={active} disabled={account?.id === actorId} onChange={event => setActive(event.target.checked)} /> Active</label>
          {account?.id === actorId && <p>You cannot deactivate your own account.</p>}
        </>}
        {editor.kind !== "edit" && <>
          <label htmlFor="admin-initialPassword">Initial password</label><input autoFocus={editor.kind === "password"} id="admin-initialPassword" className="form-control" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required aria-invalid={!!fields.initialPassword} aria-describedby="admin-password-rules" />
          <p id="admin-password-rules">{passwordRules}</p>{fieldError("initialPassword")}
          {editor.kind === "password" && <><label htmlFor="admin-confirmPassword">Confirm initial password</label><input id="admin-confirmPassword" className="form-control" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-invalid={!!fields.confirmPassword} />{fieldError("confirmPassword")}</>}
          <p>The user must change this password at next login.{editor.kind === "password" ? " Saving signs them out of all current sessions." : ""}</p>
        </>}
        <div className="admin-toolbar"><button className="btn btn-primary" type="submit">{busy ? "Saving…" : editor.kind === "password" ? "Confirm new initial password" : "Save user"}</button><button className="btn btn-outline-secondary" type="button" onClick={onClose}>Cancel</button>
          {editor.kind === "edit" && account && <button className="btn btn-outline-secondary" type="button" onClick={() => onPassword(account)}>Set new initial password</button>}
        </div>
      </fieldset>
    </form>
  </dialog>;
}
