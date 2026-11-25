import {isReviewer,json,principal,unavailable,type ModEnv} from "../moderation/guard.ts";
import {allowRequest,digest,expireCounters,quotaDay} from "./limits.ts";

const routes:Record<string,{methods:string[];access?:"reviewer"|"user"}>={
  "/api/account":{methods:["GET"]},
  "/api/account/profile":{methods:["DELETE"],access:"user"},
  "/api/account/status":{methods:["GET"],access:"user"},
  "/api/account/history":{methods:["GET"],access:"user"},
  "/api/account/feedback":{methods:["POST"],access:"user"},
  "/api/moderation/appeal":{methods:["GET","POST"],access:"user"},
  "/api/moderation/review":{methods:["GET","POST"],access:"reviewer"},
  "/api/moderation/correspondence":{methods:["GET"],access:"reviewer"},
  "/api/music-profile":{methods:["GET","PUT"],access:"user"},
  "/api/reader-preferences":{methods:["GET","POST"]},
  "/api/read-link":{methods:["POST"]},
  "/api/focus-music":{methods:["GET"]},
  "/api/discover":{methods:["GET","POST"]},
  "/api/discover/artwork":{methods:["GET"]},
  "/api/youtube-search":{methods:["POST"]},
};
const documents=new Set(["/","/appeal","/moderation","/account-deleted"]);
const providerRoutes=new Set(["/api/read-link","/api/discover","/api/discover/artwork","/api/youtube-search","/api/focus-music"]);
const contactRoutes=new Set(["/api/account/feedback","/api/moderation/appeal"]);
// Remember only confirmed denials. A cold worker always consults the shared database.
const deniedUntil=new Map<string,number>();
async function within(db:NonNullable<ModEnv["DB"]>,actor:string,limit:number,now:number){
  const minute=Math.floor(now/60000);
  const key=await digest(quotaDay(now)+"|"+actor);
  if(deniedUntil.get(key)===minute)return false;
  if(await allowRequest(db,key,minute,limit))return true;
  if(deniedUntil.size>=2048)deniedUntil.delete(deniedUntil.keys().next().value!);
  deniedUntil.set(key,minute);
  return false;
}
function slowDown(now:number,page:boolean){
  const message="Too many requests. Please try again in a minute.";
  const response=page?new Response(message,{status:429,headers:{"Content-Type":"text/plain; charset=utf-8"}}):json({error:message},429);
  response.headers.set("Retry-After",String(60-Math.floor(now/1000)%60));
  return response;
}
export async function requestBoundary(request:Request,env:ModEnv){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"") || "/";
  if(/[%\\]/.test(path) || path.includes("//"))return json({error:"Unknown route."},404);
  if(path==="/moderation" && !isReviewer(request,env))return json({error:"Reviewer access required."},403);
  const read=request.method==="GET" || request.method==="HEAD";
  const page=documents.has(path);
  if(!path.startsWith("/api/") && !page){
    if(!read)return json({error:"Method unavailable."},405);
    if(path==="/robots.txt")return new Response("User-agent: *\nDisallow: /\n",{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}});
    if(/^\/(?:assets|_next|_vinext|resource-art)\//.test(path) || ["/callback","/signin-with-chatgpt","/signout-with-chatgpt","/favicon.svg","/favicon.ico","/globe.svg","/file.svg","/window.svg"].includes(path))return null;
    return json({error:"Page not found."},404);
  }
  const rule=page?{methods:["GET"],access:undefined}:Object.hasOwn(routes,path)?routes[path]:null;
  if(!rule)return json({error:"Unknown API route."},404);
  if(!rule.methods.includes(request.method==="HEAD"?"GET":request.method)){
    const response=json({error:"Method unavailable."},405);
    response.headers.set("Allow",rule.methods.join(", "));return response;
  }
  if(!read){
    const origin=request.headers.get("Origin");
    if((origin!==null && origin!==url.origin) || request.headers.get("Sec-Fetch-Site")==="cross-site")return json({error:"Use the reader on this site."},403);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type")??""))return json({error:"JSON is required."},415);
  }
  if(rule.access==="reviewer" && !isReviewer(request,env))return json({error:"Reviewer access required."},403);
  const user=await principal(request);
  if(!user && (rule.access==="user" || (path==="/api/reader-preferences" && !read)))return json({error:"Sign in to access your reader account."},401);
  if(!env.DB)return unavailable();
  try{
    const now=Date.now();
    const edge="edge:"+(request.headers.get("CF-Connecting-IP") || "shared");
    const actor=user?"account:"+user.subject:edge;
    const traffic=page?"page":read?"read":"write";
    const caps:[string,number][]=[[actor+"|"+traffic,page?60:read?120:30]];
    if(user)caps.push([edge+"|"+traffic+"|shared",page?300:read?600:150]);
    if(providerRoutes.has(path)){
      const artwork=path.endsWith("/artwork");
      const group=artwork?"|art":"|search";
      caps.push([actor+group,artwork?90:20]);
      if(user)caps.push([edge+group+"|shared",artwork?450:100]);
    }
    if(!read && contactRoutes.has(path)){
      caps.push([actor+"|contact",3],[edge+"|contact",12],["site|contact",60]);
    }
    for(const [key,limit] of caps){
      if(!await within(env.DB,key,limit,now))return slowDown(now,page);
    }
    await expireCounters(env.DB,now);
    return null;
  }catch{return unavailable();}
}
export function documentPolicy(){
  const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  return [
    "default-src 'self'", "script-src 'self' 'nonce-"+nonce+"' https://www.youtube.com https://s.ytimg.com",
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:", "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"
  ].join("; ");
}

export function secureResponse(request:Request,response:Response,policy?:string){
  const result=new Response(response.body,response);
  result.headers.set("X-Content-Type-Options","nosniff");
  result.headers.set("Referrer-Policy","strict-origin-when-cross-origin");
  result.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  if(request.headers.has("oai-authenticated-user-id") || response.status>=400)result.headers.set("Cache-Control","private, no-store");
  if(response.headers.get("Content-Type")?.includes("text/html")){
    result.headers.append("Content-Security-Policy",policy??documentPolicy());
    result.headers.set("Cache-Control","private, no-store");
  }
  return result;
}
