import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import AuthForm, { LogoutButton } from "./components/AuthForm.js";
import App from "./App.js";
import StaffTicketQueue from "./components/StaffTicketQueue.js";
import UserManagement from "./components/UserManagement.js";
import StaffDashboard from "./components/StaffDashboard.js";

export function AuthScreens() {
  const {user,loading,error,logoutError,refresh,logout}=useAuth();
  const heading=useRef<HTMLHeadingElement>(null);
  const home = user?.role === "REQUESTER" ? "/dashboard" : "/staff/dashboard";
  const location = window.location.pathname;
  const permitted = user?.role === "REQUESTER" ? location === "/dashboard" || /^\/tickets(?:\/[^/]+)?$/.test(location)
    : location === "/staff/dashboard" || /^\/staff\/tickets(?:\/[^/]+)?$/.test(location) || (user?.role === "ADMINISTRATOR" && location === "/admin/users");
  const forbidden = Boolean(user && !user.mustChangePassword && (
    (location.startsWith("/admin/") && user.role !== "ADMINISTRATOR") ||
    (location.startsWith("/staff/") && user.role === "REQUESTER")
  ));
  const path=user?(user.mustChangePassword?"/change-password":permitted || forbidden?location + window.location.search + window.location.hash:home):"/login";
  const pathname = path.split(/[?#]/)[0];
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
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to main content</a>
    <header className="app-header"><div className="app-header-inner">
      <span className="app-brand">TokTickIT <strong>IT Service Desk</strong></span>
      <nav className="app-navigation" aria-label="Main navigation"><a className={`app-navigation-link${pathname === "/staff/dashboard" ? " active" : ""}`} href="/staff/dashboard" aria-current={pathname === "/staff/dashboard" ? "page" : undefined}>Dashboard</a><a className={`app-navigation-link${pathname.startsWith("/staff/tickets") ? " active" : ""}`} href="/staff/tickets" aria-current={pathname.startsWith("/staff/tickets") ? "page" : undefined}>Ticket Queue</a>{user.role === "ADMINISTRATOR" && <a className={`app-navigation-link${pathname === "/admin/users" ? " active" : ""}`} href="/admin/users" aria-current={pathname === "/admin/users" ? "page" : undefined}>User Management</a>}</nav>
      <div className="requester-menu"><strong>{user.displayName}</strong><span>{user.role.replaceAll("_"," ")}</span><LogoutButton/></div>
    </div></header>
    {pathname === "/staff/dashboard" ? <StaffDashboard /> : pathname.startsWith("/staff/tickets") ? <StaffTicketQueue /> : <UserManagement />}
  </div>;
}

export default function AuthApp(){return <AuthProvider><AuthScreens/></AuthProvider>;}
