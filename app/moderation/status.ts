import {activeBlock,blockedResponse,json,principal,runtimeEnv,unavailable,type ModDB,type ModEnv} from "./guard.ts";

const day=86_400_000,minute=60_000;
const elevatedLimit=60,extremeLimit=180;
const monitored=new Set(["/api/discover","/api/focus-music","/api/youtube-search","/api/music-profile"]);
type Activity={last_seen:number;returned_from_idle:number;calls:number;elevated_since:number;extreme_since:number;burst_at:number;prolonged_at:number};
type StatusInputs={activity:Activity|null;incidents:number;frequentContact:boolean;locked:boolean;now:number};
export function evaluateStatus({activity,incidents,frequentContact,locked,now}:StatusInputs){
  const reasons:string[]=[];
  let score=10,warning=false,review=false;
  const cutoff=now-15*day;
  const idle=activity && ((activity.returned_from_idle>0 && activity.returned_from_idle>=cutoff) || now-activity.last_seen>=14*day);
  if(idle){score-=1;warning=true;reasons.push("A break in activity lasted at least two weeks (−1).");}
  if(incidents){
    const points=Math.min(4,incidents);score-=points;warning=true;review=incidents>3;
    reasons.push(`${incidents} distinct filtered search ${incidents===1?"incident":"incidents"} in the last 15 days (−${points}).`);
  }
  if(activity && activity.prolonged_at>0 && activity.prolonged_at>=cutoff){
    score-=4;review=true;reasons.push("A high request rate continued for more than a minute (−4).");
  }else if(activity && activity.burst_at>0 && activity.burst_at>=cutoff){
    score-=2;warning=true;reasons.push("A burst of requests exceeded the service limit (−2).");
  }
  if(frequentContact){score-=4;review=true;reasons.push("Four or more feedback messages were submitted within a day (−4).");}
  const level=locked?"red":review || score<7?"orange":warning?"yellow":"green";
  if(locked)reasons.push("A site restriction is active. An administrator can review it.");
  return {score:locked?0:Math.max(1,score),level,label:({green:"Active",yellow:"Notice",orange:"Needs review",red:"Locked"})[level],
    reasons,lastActive:activity?.last_seen??null,locked};
}

async function touchVisit(db:ModDB,subject:string,now:number){
  // Write at most once per hour for ordinary document visits.
  await db.prepare(`INSERT INTO account_activity(subject,last_seen) SELECT ?1,?2 WHERE NOT EXISTS(SELECT 1 FROM account_closures WHERE subject=?1)
    ON CONFLICT(subject) DO UPDATE SET returned_from_idle=CASE WHEN ?2-last_seen>=?3 THEN ?2 ELSE returned_from_idle END,
    last_seen=?2 WHERE last_seen<=?2-3600000`).bind(subject,now,14*day).run();
}
export async function observeRequests(db:ModDB,subject:string,now:number){
  const bucket=Math.floor(now/minute);
  // A streak continues across adjacent qualifying minutes only. Timestamps begin when the
  // threshold is crossed, not at the start of a bucket. One burst cannot span two severity levels.
  const streak=(column:string,limit:number)=>`CASE
    WHEN minute=?3 THEN CASE WHEN ${column}=0 AND calls>=${limit} THEN ?2 ELSE ${column} END
    WHEN minute=?3-1 AND calls>${limit} THEN ${column} ELSE 0 END`;
  const row=await db.prepare(`INSERT INTO account_activity(subject,last_seen,minute,calls) SELECT ?1,?2,?3,1 WHERE NOT EXISTS(SELECT 1 FROM account_closures WHERE subject=?1)
    ON CONFLICT(subject) DO UPDATE SET
      returned_from_idle=CASE WHEN ?2-last_seen>=?4 THEN ?2 ELSE returned_from_idle END,last_seen=MAX(last_seen,?2),
      elevated_since=${streak("elevated_since",elevatedLimit)},extreme_since=${streak("extreme_since",extremeLimit)},
      burst_at=CASE WHEN minute=?3 AND calls=${elevatedLimit} THEN ?2 ELSE burst_at END,
      prolonged_at=CASE WHEN minute=?3 AND calls>=${elevatedLimit} AND elevated_since>0 AND ?2-elevated_since>60000
        AND prolonged_at<?2-60000 THEN ?2 ELSE prolonged_at END,
      calls=CASE WHEN minute=?3 THEN MIN(calls+1,100000) ELSE 1 END,minute=?3
      WHERE minute<=?3 RETURNING calls,elevated_since,extreme_since`).bind(subject,now,bucket,14*day).first<Activity>();
  if(!row || row.calls<=elevatedLimit)return null;
  if(row.calls>extremeLimit && row.extreme_since>0 && now-row.extreme_since>10*minute){
    const alert="Urgent · sustained excessive traffic";
    await db.batch([
      db.prepare(`INSERT INTO moderation_blocks(subject,blocked_at) VALUES(?1,?2)
        ON CONFLICT(subject) DO UPDATE SET blocked_at=?2,released_at=NULL
        WHERE released_at IS NOT NULL AND released_at<?3`).bind(subject,now,row.extreme_since),
      db.prepare(`INSERT OR IGNORE INTO moderation_reports(id,subject,reason,confidence,strike,created,bucket,attempts)
        SELECT ?,subject,?,100,0,blocked_at,CAST(blocked_at/600000 AS INTEGER),1 FROM moderation_blocks
        WHERE subject=? AND blocked_at=? AND released_at IS NULL`).bind(crypto.randomUUID(),alert,subject,now),
    ]);
    const block=await db.prepare("SELECT 1 AS active FROM moderation_blocks WHERE subject=? AND released_at IS NULL").bind(subject).first();
    if(block)return blockedResponse();
  }
  return Response.json({error:"You’ve made several requests in a short time. Please pause and try again."},
    {status:429,headers:{"Cache-Control":"no-store","Retry-After":String(Math.max(1,60-Math.floor(now/1000)%60))}});
}
export async function activityBoundary(request:Request,env:ModEnv):Promise<Response|null>{
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"") || "/";
  const home=path==="/" && request.method==="GET";
  if(!home && !monitored.has(path))return null;
  const origin=request.headers.get("Origin");
  if(request.headers.get("Sec-Fetch-Site")==="cross-site" || (origin && origin!==url.origin)){
    return home?null:json({error:"Open this resource from the reader."},403);
  }
  if(!["GET","POST","PUT"].includes(request.method))return null;
  const subject=request.headers.get("oai-authenticated-user-id");
  if(!subject || subject.length>256 || !env.DB)return null;
  try{
    if(home){await touchVisit(env.DB,subject,Date.now());return null;}
    return await observeRequests(env.DB,subject,Date.now());
  }catch{return unavailable();}
}

export async function getStatus(request:Request,bindings?:ModEnv,now=Date.now()){
  const p=await principal(request);
  if(!p)return json({error:"Sign in to view account status."},401);
  const db=(bindings??await runtimeEnv()).DB;
  if(!db)return unavailable();
  try{
    const since=now-15*day;
    const [activity,block,searches,feedback]=await Promise.all([
      db.prepare("SELECT * FROM account_activity WHERE subject=?").bind(p.subject).first<Activity>(),
      activeBlock(db,p),
      db.prepare(`SELECT COUNT(*) AS total FROM moderation_reports WHERE subject=?1 AND created>
        MAX(?2,COALESCE((SELECT released_at FROM moderation_blocks WHERE subject=?1),0))
        AND reason NOT LIKE 'Urgent%' AND reason!='Sensitive quoted language'`).bind(p.subject,since).first<{total:number}>(),
      db.prepare(`SELECT 1 AS hit FROM account_feedback f WHERE f.subject=?1 AND f.created>MAX(?2,
        COALESCE((SELECT released_at FROM moderation_blocks WHERE subject=?1),0))
        AND EXISTS(SELECT 1 FROM account_feedback g WHERE g.subject=f.subject AND g.created BETWEEN f.created-86400000 AND f.created
          LIMIT 1 OFFSET 3) LIMIT 1`).bind(p.subject,since).first(),
    ]);
    return json(evaluateStatus({activity,incidents:searches?.total??0,frequentContact:!!feedback,locked:!!block,now}));
  }catch{return unavailable();}
}
