import handler from "vinext/server/app-router-entry";
import {activityBoundary} from "../app/moderation/status";
import {deletedBoundary} from "../app/accountServices/deletion";
import {moderationBoundary,unavailable,type ModEnv} from "../app/moderation/guard";
import {documentPolicy,requestBoundary,secureResponse} from "../app/security/http";

export default {
  async fetch(request:Request,env:ModEnv & NonNullable<Parameters<typeof handler.fetch>[1]>,ctx:Parameters<typeof handler.fetch>[2]):Promise<Response>{
    try{
      const denied=await requestBoundary(request,env) || await deletedBoundary(request,env) ||
        await moderationBoundary(request,env) || await activityBoundary(request,env);
      if(denied)return secureResponse(request,denied);
      // Resource artwork is displayed directly. No on-demand image proxy is needed.
      if(new URL(request.url).pathname==="/_vinext/image")return secureResponse(request,new Response(null,{status:404}));
      const page=["/","/appeal","/moderation","/account-deleted"].includes(new URL(request.url).pathname.replace(/\/+$/,"") || "/");
      const policy=page?documentPolicy():undefined;
      if(policy){
        const headers=new Headers(request.headers);
        headers.set("Content-Security-Policy",policy);
        request=new Request(request,{headers});
      }
      return secureResponse(request,await handler.fetch(request,env,ctx),policy);
    }catch{return secureResponse(request,unavailable());}
  },
};
