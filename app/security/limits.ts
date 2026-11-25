import {type ModDB} from "../moderation/guard.ts";

const pacific=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"});
export const quotaDay=(now:number)=>pacific.format(now);

export async function digest(value:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}

export async function allowRequest(db:ModDB,actor:string,window:number,limit:number){
  // One conditional write keeps simultaneous requests inside the same allowance.
  return Boolean(await db.prepare(`INSERT INTO request_windows(actor,window,calls) VALUES(?1,?2,1)
    ON CONFLICT(actor) DO UPDATE SET window=?2,calls=CASE WHEN window=?2 THEN calls+1 ELSE 1 END
    WHERE window!=?2 OR calls<?3 RETURNING calls`).bind(actor,window,limit).first());
}

export async function reserveCall(db:ModDB,provider:string,actor:string,lookup:string,now:number){
  const id=crypto.randomUUID(),day=quotaDay(now);
  const row=await db.prepare(`INSERT INTO provider_calls(id,provider,day,actor,lookup,created)
    SELECT ?1,?2,?3,?4,?5,?6 WHERE
    (SELECT count(*) FROM provider_calls WHERE provider=?2 AND day=?3)<80 AND
    (SELECT count(*) FROM provider_calls WHERE provider=?2 AND day=?3 AND actor=?4)<5
    RETURNING id`).bind(id,provider,day,actor,lookup,now).first<{id:string}>();
  return row?.id;
}

let cleanedMinute=-1;
export async function expireCounters(db:ModDB,now:number){
  const minute=Math.floor(now/60000);
  if(cleanedMinute===minute)return;
  cleanedMinute=minute;
  await db.batch([
    db.prepare("DELETE FROM request_windows WHERE window<?").bind(minute-2),
    db.prepare("DELETE FROM provider_calls WHERE day<?").bind(quotaDay(now)),
    db.prepare("UPDATE provider_calls SET result=NULL WHERE created<? AND result IS NOT NULL").bind(now-600000),
  ]);
}
