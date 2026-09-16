import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import AuthForm, { LogoutButton } from "./components/AuthForm.js";
import App from "./App.js";

export function AuthScreens() {
  const {user,loading,error,logoutError,refresh,logout}=useAuth();
  const heading=useRef<HTMLHeadingElement>(null);
  const home = user?.role === "REQUESTER" ? "/tickets/new" : user?.role === "ADMINISTRATOR" ? "/admin/users" : "/staff/tickets";
  const location = window.location.pathname;
  const permitted = user?.role === "REQUESTER" ? /^\/tickets(?:\/[^/]+)?$/.test(location)
    : user?.role === "ADMINISTRATOR" ? ["/admin/users", "/staff/tickets"].includes(location) : location === "/staff/tickets";
  const forbidden = Boolean(user && !user.mustChangePassword && (
    (location.startsWith("/admin/") && user.role !== "ADMINISTRATOR") ||
    (location.startsWith("/staff/") && user.role === "REQUESTER")
  ));
  const path=user?(user.mustChangePassword?"/change-password":permitted || forbidden?location + window.location.search:home):"/login";
  useEffect(()=>{
    if(!loading && !error)window.history.replaceState({},"",path);
    heading.current?.focus();
  },[path,loading,error]);
  if(loading)return <main className="requester-page"><p role="status">Checking your session…</p></main>;
  if(logoutError)return <main className="requester-page"><div role="alert">{logoutError}<button type="button" onClick={()=>{void logout().catch(()=>{});}}>Retry logout</button></div></main>;
  if(error)return <main className="requester-page"><div role="alert">{error}<button type="button" onClick={()=>{void refresh();}}>Retry</button></div></main>;
  if(!user)return <AuthForm key="login" mode="login"/>;
  if(user.mustChangePassword)return <AuthForm key={`change-${user.id}`} mode="change"/>;
  if(forbidden) return <main className="requester-page"><h1 ref={heading} tabIndex={-1}>Forbidden</h1><p>You do not have access to this screen.</p><a href={home}>Return to your home</a><LogoutButton /></main>;
  if(user.role === "REQUESTER") return <App key={user.id} />;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header"><div className="app-header-inner">
      <span className="app-brand">TokTickIT <strong>IT Service Desk</strong></span>
      <nav aria-label="Main navigation"><a href="/staff/tickets" aria-current={path === "/staff/tickets" ? "page" : undefined}>Ticket Queue</a>{user.role === "ADMINISTRATOR" && <a href="/admin/users" aria-current={path === "/admin/users" ? "page" : undefined}>User Management</a>}</nav>
      <div className="requester-menu"><strong>{user.displayName}</strong><span>{user.role.replaceAll("_"," ")}</span><LogoutButton/></div>
    </div></header>
    <main id="main-content" tabIndex={-1} className="requester-page"><section className="requester-card">
      <h1 ref={heading} tabIndex={-1}>{path === "/admin/users" ? "User Management" : "Ticket Queue"}</h1>
      <p>This screen is planned for the corresponding Lab 3 feature issue. No operational actions are available yet.</p>
    </section></main>
  </div>;
}

export default function AuthApp(){return <AuthProvider><AuthScreens/></AuthProvider>;}
