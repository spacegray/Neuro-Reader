import {and,eq} from "drizzle-orm";
import {musicProfiles} from "../../../db/musicSchema";
import {emptyRemote,validCloud,type RemoteMusic} from "../../musicProfile";

export const dynamic="force-dynamic";
const limit=768*1024;
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
function owner(request:Request){
  const user=request.headers.get("oai-authenticated-user-id");
  // The expected owner prevents an old browser tab from writing to a newly signed-in profile.
  return user && request.headers.get("x-music-account")===user?user:null;
}
async function current(id:string):Promise<RemoteMusic>{
  const {getDb}=await import("../../../db");
  const rows=await getDb().select().from(musicProfiles).where(eq(musicProfiles.userId,id)).limit(1);
  return rows.length?{revision:rows[0].revision,profile:JSON.parse(rows[0].payload)}:emptyRemote();
}
export async function GET(req:Request){
  const id=owner(req);
  if(!id)return reply({error:"Sign in to access your music profile."},401);
  return reply(await current(id));
}
async function readBody(req:Request){
  if(!req.body || Number(req.headers.get("content-length"))>limit)throw new Error("size");
  const reader=req.body.getReader(), chunks:Uint8Array[]=[];
  let length=0;
  for(;;){
    const part=await reader.read();if(part.done)break;
    length+=part.value.length;
    if(length>limit){await reader.cancel();throw new Error("size");}
    chunks.push(part.value);
  }
  const buffer=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(buffer));
}
export async function PUT(req:Request){
  const id=owner(req);
  if(!id)return reply({error:"Sign in to save music."},401);
  if(req.headers.get("sec-fetch-site")==="cross-site" || !req.headers.get("content-type")?.startsWith("application/json"))return reply({error:"Unsupported request."},403);
  let body;
  try{body=await readBody(req);}catch(e){return reply({error:"Invalid music profile."},e instanceof Error && e.message==="size"?413:400);}
  if(!Number.isSafeInteger(body?.revision) || body.revision<0 || !validCloud(body.profile))return reply({error:"Invalid music profile."},422);
  const db=(await import("../../../db")).getDb();
  const revision=body.revision+1,payload=JSON.stringify(body.profile);
  const updated=body.revision===0
    ?await db.insert(musicProfiles).values({userId:id,revision,payload}).onConflictDoNothing().returning({revision:musicProfiles.revision})
    :await db.update(musicProfiles).set({revision,payload}).where(and(eq(musicProfiles.userId,id),eq(musicProfiles.revision,body.revision))).returning({revision:musicProfiles.revision});
  if(!updated.length)return reply(await current(id),409);
  return reply({revision,profile:body.profile});
}
