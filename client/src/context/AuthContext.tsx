import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authRequest, AuthError, type AuthUser } from "../auth-api.js";

interface AuthState {
  user:AuthUser|null; loading:boolean; error:string; logoutError:string;
  refresh:()=>Promise<void>;
  login:(email:string,password:string)=>Promise<void>;
  changePassword:(values:Record<string,string>)=>Promise<void>;
  logout:()=>Promise<void>;
}
const Context=createContext<AuthState|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [logoutError,setLogoutError]=useState("");
  const signedOut=useRef(false);
  const generation=useRef(0);
  const controller=useRef<AbortController|null>(null);
  const invalidate=useCallback(()=>{generation.current++;controller.current?.abort();},[]);
  const begin=useCallback(()=>{
    controller.current?.abort();controller.current=new AbortController();
    const version=++generation.current;
    return {signal:controller.current.signal,version};
  },[]);
  const refresh=useCallback(async()=>{
    if(signedOut.current){window.history.replaceState({},"","/login");return;}
    const {signal,version}=begin();setLoading(true);setError("");
    try {const next=await authRequest("me",undefined,signal);if(version===generation.current)setUser(next);}
    catch(e) {
      if(version!==generation.current)return;
      setUser(null);
      if(!(e instanceof AuthError && e.code==="AUTHENTICATION_REQUIRED"))setError("Unable to check your session. Try again.");
    } finally {if(version===generation.current)setLoading(false);}
  },[begin]);
  useEffect(()=>{
    // Retire the old client identity; it is never used to restore an auth session.
    try {sessionStorage.removeItem("toktickit.requesterId");}catch { /* storage may be disabled */ }
    const startup=window.setTimeout(()=>{void refresh();},0);
    const revalidate=()=>{void refresh();};
    window.addEventListener("pageshow",revalidate);
    window.addEventListener("popstate",revalidate);
    return ()=>{window.clearTimeout(startup);invalidate();window.removeEventListener("pageshow",revalidate);window.removeEventListener("popstate",revalidate);};
  },[refresh,invalidate]);
  const action=async(path:string,body:unknown)=>{
    const {signal,version}=begin();
    if(path==="logout"){signedOut.current=true;setUser(null);setLoading(true);setLogoutError("");}
    try {
      const next=await authRequest(path,body,signal);
      if(version===generation.current){setUser(next);setError("");setLogoutError("");if(next)signedOut.current=false;}
    }catch(e){
      if(version===generation.current && e instanceof AuthError && e.code==="AUTHENTICATION_REQUIRED")setUser(null);
      if(version===generation.current && path==="logout")setLogoutError("Unable to confirm logout. Retry logout to invalidate the server session.");
      throw e;
    }finally {if(version===generation.current && path==="logout")setLoading(false);}
  };
  return <Context.Provider value={{user,loading,error,logoutError,refresh,
    login:(email,password)=>action("login",{email,password}),
    changePassword:values=>action("change-password",values),logout:()=>action("logout",{}),
  }}>{children}</Context.Provider>;
}
export function useAuth() {const context=useContext(Context);if(!context)throw new Error("AuthProvider is required");return context;}
