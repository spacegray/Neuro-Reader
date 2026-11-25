import {boundedJson,isReviewer,json,type ModEnv,unavailable} from "./guard.ts";


export async function getReview(request:Request,env:ModEnv){
  
  if(!isReviewer(request,env))return json({error:"Reviewer access required."},403);
  const db=env.DB;if(!db)return unavailable();
  try {
    const [reports,blocks,appeals]=await Promise.all([
      db.prepare(`SELECT r.id,r.subject,r.reason,r.confidence,r.strike,r.created,r.attempts FROM moderation_reports r
        WHERE r.created>? ORDER BY r.created DESC LIMIT 100`).bind(Date.now()-90*86400000).all(),
      db.prepare("SELECT subject,blocked_at FROM moderation_blocks WHERE released_at IS NULL ORDER BY blocked_at DESC LIMIT 250").all(),
      db.prepare("SELECT id,subject,block_subject,message,documentation,created,status FROM moderation_appeals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created DESC LIMIT 100").all(),
    ]);
    return json({reports:reports.results,blocks:blocks.results,appeals:appeals.results});
  }catch{return unavailable();}
}
export async function postReview(request:Request,env:ModEnv){
  if(!isReviewer(request,env))return json({error:"Reviewer access required."},403);
  const data=await boundedJson(request,1500);
  if(!data || !["release","decline"].includes(String(data.action)) || typeof data.subject!=="string" || data.subject.length>256 ||
      (data.action==="decline" && (typeof data.appeal!=="string" || data.appeal.length>64)))return json({error:"Invalid review action."},400);
  const db=env.DB;if(!db)return unavailable();
  const now=Date.now();
  try {
    if(data.action==="release"){
      await db.batch([
        db.prepare("UPDATE account_activity SET calls=0,elevated_since=0,extreme_since=0,burst_at=0,prolonged_at=0 WHERE subject=?").bind(data.subject),
        db.prepare("UPDATE moderation_blocks SET released_at=? WHERE subject=? AND released_at IS NULL").bind(now,data.subject),
        db.prepare("UPDATE moderation_appeals SET status='approved',reviewed=? WHERE block_subject=? AND status='pending'").bind(now,data.subject),
      ]);
    }else{
      await db.prepare("UPDATE moderation_appeals SET status='declined',reviewed=? WHERE id=? AND block_subject=? AND status='pending'")
        .bind(now,data.appeal as string,data.subject).run();
    }
    return json({ok:true});
  }catch{return unavailable();}
}
