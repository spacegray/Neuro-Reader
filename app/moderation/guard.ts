import {blockedMessage,cleanText,incidentFor,supportedQuery,unsupported} from "./policy.ts";

// Structural types allow the same policy to run at the Worker boundary and in Vinext handlers.
export interface Statement {
  bind(...values:(string|number|null)[]):Statement;
  first<T=Record<string,unknown>>():Promise<T|null>;
  all<T=Record<string,unknown>>():Promise<{results:T[]}>;
  run():Promise<unknown>;
}
export interface ModDB {prepare(sql:string):Statement;batch(queries:Statement[]):Promise<unknown>}
export type ModEnv={DB?:ModDB;MODERATION_OWNER_EMAIL?:string;MODERATION_OWNER_ID?:string};
export async function runtimeEnv():Promise<ModEnv>{
  try {const {env}=await import("cloudflare:workers");return env as unknown as ModEnv;}catch{return {};}
}
export function json(payload:unknown,status=200) {
  return Response.json(payload,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Cookie"}});
}
export const unavailable=()=>json({code:"unavailable",error:"This service is temporarily unavailable. Please try again."},503);
export async function boundedJson(request:Request,limit:number):Promise<Record<string,unknown>|null>{
  const origin=request.headers.get("Origin");
  if(request.headers.get("Sec-Fetch-Site")==="cross-site" || (origin && origin!==new URL(request.url).origin) ||
     !/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "") || Number(request.headers.get("Content-Length"))>limit || !request.body)return null;
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});let size=0,body="";
  try {
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>limit){await reader.cancel();return null;}body+=decoder.decode(value,{stream:true});}
    const obj=JSON.parse(body+decoder.decode());
    return obj && typeof obj==="object" && !Array.isArray(obj)?obj:null;
  }catch{return null;}finally{reader.releaseLock();}
}
export function isReviewer(request:Request,env:ModEnv) {
  const id=request.headers.get("oai-authenticated-user-id");
  const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return !!id && (env.MODERATION_OWNER_ID ? id===env.MODERATION_OWNER_ID :
    !!env.MODERATION_OWNER_EMAIL && email===env.MODERATION_OWNER_EMAIL.trim().toLowerCase());
}
async function emailKey(email:string) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("neurotype:verified-email:v1:"+email.trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
}
export async function principal(request:Request) {
  const subject=request.headers.get("oai-authenticated-user-id");
  if(!subject || subject.length>256)return null;
  const email=request.headers.get("oai-authenticated-user-email");
  return {subject,mail:email?await emailKey(email):""};
}
type Principal=NonNullable<Awaited<ReturnType<typeof principal>>>;
async function registerContact(db:ModDB,p:Principal) {
  if(p.mail)await db.prepare("INSERT OR IGNORE INTO moderation_contacts(subject,email_key) VALUES (?,?)").bind(p.subject,p.mail).run();
}
export async function activeBlock(db:ModDB,p:Principal) {
  return db.prepare(`SELECT b.subject,b.blocked_at FROM moderation_blocks b
    WHERE b.released_at IS NULL AND (b.subject=? OR EXISTS(
      SELECT 1 FROM moderation_contacts c WHERE c.subject=b.subject AND
      (c.email_key=? OR c.email_key IN (SELECT email_key FROM moderation_contacts WHERE subject=?))))
    ORDER BY b.blocked_at DESC LIMIT 1`).bind(p.subject,p.mail,p.subject).first<{subject:string;blocked_at:number}>();
}
export function blockedResponse(){return json({code:"blocked",error:blockedMessage,appeal:"/appeal"},403);}
export async function moderationBoundary(request:Request,env:ModEnv):Promise<Response|null>{
  const path=new URL(request.url).pathname.replace(/\/+$/,"") || "/";
  if(path==="/account-deleted" || path==="/api/account/profile" || path==="/api/account/history" || path==="/api/account/status" || path==="/appeal" || path==="/moderation" || path==="/api/moderation/review" || path==="/api/moderation/appeal" ||
     path.startsWith("/_next/static/") || path.startsWith("/_vinext/") || path.startsWith("/assets/") ||
     ["/signin-with-chatgpt","/signout-with-chatgpt","/callback","/favicon.svg","/favicon.ico"].includes(path))return null;
  const p=await principal(request);
  if(!p)return null;
  if(!env.DB)return unavailable();
  try {
    if(path==="/" && request.method==="GET")await registerContact(env.DB,p);
    const block=await activeBlock(env.DB,p);
    if(block) {
      if(path.startsWith("/api/") || !["GET","HEAD"].includes(request.method))return blockedResponse();
      return new Response(null,{status:303,headers:{Location:"/appeal","Cache-Control":"private, no-store"}});
    }
    return null;
  }catch{return unavailable();}
}
const day=86400000;
export async function guardSearch(request:Request,raw:string,bindings?:ModEnv):Promise<Response|null>{
  if(supportedQuery(raw))return null; // Account-wide blocks are checked at the Worker boundary.
  const incident=typeof raw==="string" && raw.length<=180?incidentFor(cleanText(raw)):null;
  if(!incident || request.method!=="POST")return json({error:unsupported,code:"unsupported"},400);
  const origin=request.headers.get("Origin");
  if(request.headers.get("Sec-Fetch-Site")==="cross-site" || (origin && origin!==new URL(request.url).origin))return json({error:unsupported,code:"unsupported"},400);
  const env=bindings ?? await runtimeEnv();
  if(!env.DB)return unavailable();
  const db=env.DB;
  try {
    const p=await principal(request);
    const now=Date.now(),subject=p?.subject || "guest";
    if(p)await registerContact(db,p);
    // A duplicate or retried submission counts once per category per ten minutes.
    // Anonymous reports are category totals; they never identify or restrict a visitor.
    const bucket=Math.floor(now/(p?600000:day));
    const insert=db.prepare(`INSERT INTO moderation_reports(id,subject,reason,confidence,strike,created,bucket,attempts)
      VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(subject,reason,bucket) DO UPDATE SET attempts=MIN(999999,attempts+1)`)
      .bind(crypto.randomUUID(),subject,incident.reason,incident.confidence,Number(!!p && incident.strike),now,bucket);
    const queries=[insert];
    if(p && incident.strike){
      queries.push(db.prepare(`INSERT INTO moderation_blocks(subject,blocked_at,released_at)
        SELECT ?,?,NULL WHERE (SELECT COUNT(DISTINCT bucket) FROM moderation_reports WHERE subject=? AND strike=1
          AND created>MAX(?,COALESCE((SELECT released_at FROM moderation_blocks WHERE subject=?),0)))>=3
        ON CONFLICT(subject) DO UPDATE SET blocked_at=excluded.blocked_at,released_at=NULL WHERE released_at IS NOT NULL`)
        .bind(subject,now,subject,now-7*day,subject));
    }
    // Never expire a pending appeal or a block. Old incident details can be discarded.
    queries.push(db.prepare("DELETE FROM moderation_reports WHERE id IN (SELECT id FROM moderation_reports WHERE created<? LIMIT 100)").bind(now-90*day));
    await db.batch(queries);
    if(p && incident.strike && await activeBlock(db,p))return blockedResponse();
    return json({error:unsupported,code:"unsupported"},400);
  }catch{return unavailable();}
}
