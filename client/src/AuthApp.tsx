import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import AuthForm, { LogoutButton } from "./components/AuthForm.js";

export function AuthScreens() {
  const {user,loading,error,logoutError,refresh,logout}=useAuth();
  const heading=useRef<HTMLHeadingElement>(null);
  const path=user?(user.mustChangePassword?"/change-password":"/account"):"/login";
  useEffect(()=>{
    if(!loading && !error)window.history.replaceState({},"",path);
    heading.current?.focus();
  },[path,loading,error]);
  if(loading)return <main className="requester-page"><p role="status">Checking your session…</p></main>;
  if(logoutError)return <main className="requester-page"><div role="alert">{logoutError}<button type="button" onClick={()=>{void logout().catch(()=>{});}}>Retry logout</button></div></main>;
  if(error)return <main className="requester-page"><div role="alert">{error}<button type="button" onClick={()=>{void refresh();}}>Retry</button></div></main>;
  if(!user)return <AuthForm key="login" mode="login"/>;
  if(user.mustChangePassword)return <AuthForm key={`change-${user.id}`} mode="change"/>;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header"><div className="app-header-inner">
      <span className="app-brand">TokTickIT <strong>IT Service Desk</strong></span>
      <div className="requester-menu"><strong>{user.displayName}</strong><span>{user.role.replaceAll("_"," ")}</span><LogoutButton/></div>
    </div></header>
    <main id="main-content" tabIndex={-1} className="requester-page"><section className="requester-card">
      <h1 ref={heading} tabIndex={-1}>Your account is ready</h1>
      <p>You are signed in as {user.email}.</p>
    </section></main>
  </div>;
}

export default function AuthApp(){return <AuthProvider><AuthScreens/></AuthProvider>;}
