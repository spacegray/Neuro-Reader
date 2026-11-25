import {and,eq} from "drizzle-orm";
import {readerPreferences} from "../../../db/preferencesSchema";
import {applyPreference,initialReaderProfile,validAction,type ReaderProfile} from "../../readerPreferenceModel";
import {boundedJson,json} from "../../moderation/guard";

export const dynamic="force-dynamic";
type Envelope={profile:ReaderProfile;receipts:string[]};
const owner=(r:Request)=>r.headers.get("oai-authenticated-user-id");
async function load(scope:string){
  const db=(await import("../../../db")).getDb();
  const read=()=>db.select().from(readerPreferences).where(eq(readerPreferences.userId,scope)).get();
  let row=await read();
  if(!row){
    const empty:Envelope={profile:initialReaderProfile(Date.now()),receipts:[]};
    await db.insert(readerPreferences).values({userId:scope,revision:0,payload:JSON.stringify(empty)}).onConflictDoNothing();
    row=await read();
  }
  if(!row)throw Error("Unavailable");
  return {db,row,saved:JSON.parse(row.payload) as Envelope};
}
export async function GET(r:Request){
  const scope=owner(r);if(!scope)return json({scope:null});
  const {saved}=await load(scope);
  return json({scope,profile:saved.profile});
}
export async function POST(r:Request){
  const scope=owner(r);
  if(!scope || r.headers.get("x-reader-account")!==scope)return json({error:"Sign in to save these preferences."},401);
  const data=await boundedJson(r,12000);
  if(!data || typeof data.id!=="string" || !/^[a-zA-Z0-9-]{16,64}$/.test(data.id) || !Array.isArray(data.actions) ||
    data.actions.length<1 || data.actions.length>48 || !data.actions.every(validAction))return json({error:"Unsupported preference."},400);
  for(let attempt=0;attempt<4;attempt++){
    const {db,row,saved}=await load(scope);
    if(saved.receipts.includes(data.id))return json({scope,profile:saved.profile});
    const now=Date.now(),profile=data.actions.reduce((p,a)=>applyPreference(p,a,now),saved.profile);
    const updated=await db.update(readerPreferences).set({revision:row.revision+1,
      payload:JSON.stringify({profile,receipts:[...saved.receipts.slice(-31),data.id]})})
      .where(and(eq(readerPreferences.userId,scope),eq(readerPreferences.revision,row.revision))).returning({revision:readerPreferences.revision});
    if(updated.length)return json({scope,profile});
  }
  return json({error:"Preferences changed on another device. Retry saving."},409);
}
