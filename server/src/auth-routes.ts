import { Router, json, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ApiError, toErrorResponse } from "./errors.js";
import { authenticate, changePassword, currentUser, login, logout, parseAuthBody, SESSION_COOKIE, SESSION_MAX_AGE } from "./auth-service.js";

export function readSessionToken(req: Request): string | undefined {
  const values=(req.headers.cookie ?? "").split(";").map(part=>part.trim()).filter(part=>part.startsWith(SESSION_COOKIE+"="));
  if(values.length!==1)return undefined;
  const token=values[0].slice(SESSION_COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(token)?token:undefined;
}

export function authCookieOptions() {
  return {httpOnly:true, sameSite:"lax" as const, path:"/", secure:process.env.NODE_ENV!=="development" && process.env.NODE_ENV!=="test"};
}

export function createAuthRouter(database: () => PrismaClient) {
  const router=Router();
  const attempts=new Map<string,{count:number;expires:number}>();
  const windowMs=15*60*1000;
  router.use((_req,res,next)=>{res.set("Cache-Control","no-store");res.locals.requestId=randomUUID();next();});
  router.use(cors({origin: (_origin,callback)=>callback(null,process.env.CLIENT_ORIGIN ?? "http://localhost:5173"),credentials:true}));
  router.use((req,res,next)=>{
    if(!["GET","HEAD","OPTIONS"].includes(req.method) && req.get("Origin")!==(process.env.CLIENT_ORIGIN ?? "http://localhost:5173")) {
      next(new ApiError(403,"ORIGIN_NOT_ALLOWED","The request origin is not allowed."));return;
    }
    next();
  });
  router.use(json({limit:"16kb"}));
  const route=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{void handler(req,res).catch(next);};
  const setSession=(res:Response,result:Awaited<ReturnType<typeof login>>)=>{
    res.cookie(SESSION_COOKIE,result.token,{...authCookieOptions(),maxAge:SESSION_MAX_AGE});
    res.status(200).json({user:result.user});
  };
  router.post("/login",route(async(req,res)=>{
    const input=parseAuthBody(req.body,["email","password"]);
    const now=Date.now();
    for(const [key,value] of attempts)if(value.expires<=now)attempts.delete(key);
    const key=JSON.stringify([req.ip,input.email.trim().toLowerCase()]);
    const bucket=attempts.get(key);
    if((bucket && bucket.count>=10) || (!bucket && attempts.size>=10000)) {
      res.set("Retry-After",String(Math.max(1,Math.ceil(((bucket?.expires ?? now+windowMs)-now)/1000))));
      throw new ApiError(429,"TOO_MANY_ATTEMPTS","Too many attempts. Try again later.");
    }
    attempts.set(key,{count:(bucket?.count ?? 0)+1,expires:bucket?.expires ?? now+windowMs});
    setSession(res,await login(database(),input.email,input.password,readSessionToken(req)));
  }));
  router.get("/me",route(async(req,res)=>{
    const session=await authenticate(database(),readSessionToken(req));
    res.json({user:currentUser(session.user)});
  }));
  router.post("/change-password",route(async(req,res)=>{setSession(res,await changePassword(database(),readSessionToken(req),req.body));}));
  router.post("/logout",route(async(req,res)=>{
    await logout(database(),readSessionToken(req));
    res.clearCookie(SESSION_COOKIE,authCookieOptions());res.sendStatus(204);
  }));
  router.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    void _next;
    const parserError=error as {type?:string};
    const result=toErrorResponse(parserError?.type==="entity.parse.failed" || parserError?.type==="entity.too.large"
      ? new ApiError(400,"VALIDATION_ERROR","Send a valid JSON request within the size limit.") : error);
    const {details,...safe}=result.body.error;
    res.status(result.status).json({error:{...safe,requestId:res.locals.requestId,
      ...(details?{fieldErrors:Object.fromEntries(details.map(d=>[d.field,d.issue]))}:{})}});
  });
  return router;
}

/** Reusable guard for the #31 route cutover. No caller-supplied requester ID. */
export function requireAuthentication(database:()=>PrismaClient, allowPasswordChange=false) {
  return (req:Request,res:Response,next:NextFunction)=>{
    void Promise.resolve().then(() => authenticate(database(),readSessionToken(req))).then(session=>{
      if(session.user.mustChangePassword && !allowPasswordChange) throw new ApiError(403,"PASSWORD_CHANGE_REQUIRED","Change your initial password to continue.");
      res.locals.authenticatedUser=currentUser(session.user);next();
    }).catch(error=>{const result=toErrorResponse(error);res.set("Cache-Control","no-store");res.status(result.status).json(result.body);});
  };
}
