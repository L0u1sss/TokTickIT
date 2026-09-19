import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthError } from "../auth-api.js";
import { useAuth } from "../context/AuthContext.js";

export const PASSWORD_RULES="Use 12–128 characters, no leading/trailing whitespace, and at least three of lowercase, uppercase, numbers and symbols.";
function passwordError(value:string) {
  const groups=[/\p{Ll}/u,/\p{Lu}/u,/\p{Nd}/u,/[^\p{L}\p{N}\s]/u].filter(r=>r.test(value)).length;
  return Array.from(value).length<12 || Array.from(value).length>128 || value.trim()!==value || groups<3?PASSWORD_RULES:"";
}
export default function AuthForm({mode}:{mode:"login"|"change"}) {
  const auth=useAuth();
  const [values,setValues]=useState<Record<string,string>>({email:"",password:"",currentPassword:"",newPassword:"",confirmPassword:""});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [visible,setVisible]=useState<Record<string,boolean>>({});
  const summary=useRef<HTMLDivElement>(null);
  const inFlight=useRef(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{if(attempt>0)summary.current?.focus();},[attempt]);
  const fields=mode==="login"?[["email","Email"],["password","Password"]]:
    [["currentPassword","Current Password"],["newPassword","New Password"],["confirmPassword","Confirm New Password"]];
  const validate=(field:string,value:string)=>{
    if(!value)return "This field is required.";
    if(field==="email")return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || Array.from(value.trim()).length>254?"Enter a valid email address.":"";
    if(field==="newPassword")return passwordError(value);
    if(field==="confirmPassword" && value!==values.newPassword)return "Passwords must match.";
    return Array.from(value).length>128?"Use at most 128 characters.":"";
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(inFlight.current)return;
    const invalid=Object.fromEntries(fields.map(([field])=>[field,validate(field,values[field])]).filter(([,value])=>value));
    setErrors(invalid);setMessage("");
    if(Object.keys(invalid).length){setAttempt(n=>n+1);return;}
    inFlight.current=true;setBusy(true);
    try {
      if(mode==="login")await auth.login(values.email.trim(),values.password);
      else await auth.changePassword({currentPassword:values.currentPassword,newPassword:values.newPassword,confirmPassword:values.confirmPassword});
    }catch(e){
      setMessage(e instanceof AuthError?e.message:"The request could not be completed. Try again.");
      if(e instanceof AuthError)setErrors(e.fieldErrors);
      setAttempt(n=>n+1);
    }finally{
      setValues(previous=>({...previous,password:"",currentPassword:"",newPassword:"",confirmPassword:""}));
      inFlight.current=false;setBusy(false);
    }
  };
  return <main id="main-content" tabIndex={-1} className="requester-page">
    <section className="requester-card auth-card" aria-labelledby="auth-title">
      <span className="brand-mark" aria-hidden="true">T</span>
      <p>TokTickIT IT Service Desk</p>
      <h1 id="auth-title">{mode==="login"?"Sign in":"Change your initial password"}</h1>
      {mode==="change" && <p id="password-rules">{PASSWORD_RULES}</p>}
      <p>* Required</p>
      {(message || Object.keys(errors).some(k=>errors[k])) && <div ref={summary} tabIndex={-1} role="alert" className="auth-error">
        <p>{message || "Please correct the highlighted fields."}</p>
        <ul>{Object.entries(errors).filter(([,issue])=>issue).map(([field,issue])=><li key={field}><a href={`#auth-${field}`} onClick={e=>{e.preventDefault();document.getElementById(`auth-${field}`)?.focus();}}>{fields.find(([key])=>key===field)?.[1] ?? field}: {issue}</a></li>)}</ul>
      </div>}
      <form onSubmit={event=>{void submit(event);}} noValidate aria-busy={busy}>
        {fields.map(([field,label])=><div className="auth-field" key={field}>
          <label htmlFor={`auth-${field}`}>{label} <span aria-hidden="true">*</span></label>
          <input id={`auth-${field}`} name={field} type={field==="email"?"email":visible[field]?"text":"password"}
            autoComplete={field==="email"?"username":field==="password" || field==="currentPassword"?"current-password":"new-password"}
            required disabled={busy} value={values[field]}
            aria-invalid={Boolean(errors[field])} aria-describedby={[errors[field]?`error-${field}`:"",mode==="change" && field==="newPassword"?"password-rules":""].filter(Boolean).join(" ") || undefined}
            onChange={e=>setValues(previous=>({...previous,[field]:e.target.value}))}
            onBlur={()=>setErrors(previous=>({...previous,[field]:validate(field,values[field])}))}/>
          {field!=="email" && <button className="zen-button secondary-button" type="button" disabled={busy} aria-pressed={Boolean(visible[field])} onClick={()=>setVisible(previous=>({...previous,[field]:!previous[field]}))}>{visible[field]?"Hide":"Show"} {label}</button>}
          {errors[field] && <p id={`error-${field}`} className="auth-error">{errors[field]}</p>}
        </div>)}
        <button className="zen-button continue-button" type="submit" disabled={busy}>{busy?(mode==="login"?"Signing in…":"Saving…"):(mode==="login"?"Sign in":"Save password")}</button>
      </form>
      <p role="status">{busy?"Please wait.":""}</p>
      {mode==="change" && <LogoutButton disabled={busy}/>}
    </section>
  </main>;
}

export function LogoutButton({disabled=false}:{disabled?:boolean}) {
  const auth=useAuth();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  return <div><button className="zen-button" type="button" disabled={disabled || busy} onClick={()=>{
    setBusy(true);setError("");
    void auth.logout().catch(()=>setError("Unable to confirm logout. Retry logout to invalidate the server session.")).finally(()=>setBusy(false));
  }}>{busy?"Signing out…":error?"Retry logout":"Logout"}</button>{error && <p role="alert">{error}</p>}</div>;
}
