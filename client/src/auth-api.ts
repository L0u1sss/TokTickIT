const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export interface AuthUser {
  id: number; displayName: string; email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  mustChangePassword: boolean;
}
export class AuthError extends Error {
  constructor(public status:number, public code:string, message:string,
    public fieldErrors:Record<string,string> = {}) {super(message);}
}
export async function authRequest(path:string, body?:unknown, signal?:AbortSignal):Promise<AuthUser|null> {
  const response=await fetch(`${API_URL}/api/auth/${path}`,{
    method:body===undefined?"GET":"POST",credentials:"include",cache:"no-store",signal,
    ...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),
  });
  if(!response.ok) {
    let data:{error?:{code?:string;message?:string;fieldErrors?:Record<string,string>}}={};
    try {data=await response.json();}catch { /* use a safe fallback for non-JSON failures */ }
    const code=data.error?.code ?? "INTERNAL_ERROR";
    const message=code==="AUTHENTICATION_FAILED"?"Unable to sign in with the provided credentials.":
      response.status>=500?"The request could not be completed. Try again.":data.error?.message ?? "The request could not be completed. Try again.";
    throw new AuthError(response.status,code,message,data.error?.fieldErrors);
  }
  if(response.status===204)return null;
  return (await response.json() as {user:AuthUser}).user;
}
