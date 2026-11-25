import {boundedJson,guardSearch,json,principal,runtimeEnv,type ModEnv} from "../../moderation/guard";
import {filters} from "../../musicLibrary";
import {youtubeMatches} from "./provider";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const data=await boundedJson(request,1600);
  if(!data || typeof data.query!=="string" || data.query.length>100)return json({error:"Enter a shorter music search."},400);
  const spec={query:data.query.trim(),mood:"",genre:"",activity:""};
  for(const k of ["mood","genre","activity"] as const){
    if(data[k]!=="" && !filters[k].includes(data[k] as string))return json({error:"Choose a listed filter."},400);
    spec[k]=data[k] as string;
  }
  const denied=await guardSearch(request,spec.query || "focus music");
  if(denied)return denied;
  const env=await runtimeEnv() as ModEnv & {YOUTUBE_API_KEY?:string};
  try{return json(await youtubeMatches(spec,{key:env.YOUTUBE_API_KEY,subject:(await principal(request))?.subject,db:env.DB},request.signal));}
  catch{return json({source:"unavailable",tracks:[]},503);}
}
