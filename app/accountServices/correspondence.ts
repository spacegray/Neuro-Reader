import {boundedJson,isReviewer,json,principal,unavailable} from "../moderation/guard.ts";
import {cleanText,validAppeal} from "../moderation/policy.ts";
import {draftEmail,notifyOwner,type FeedbackEnv,type Notice} from "./notifications.ts";

const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const day=86400000;
const unauthorized=()=>json({error:"Sign in to access this record."},401);
export async function feedback(request:Request,env:FeedbackEnv){
  const user=await principal(request);if(!user)return unauthorized();
  const data=await boundedJson(request,4200);
  if(!data || typeof data.message!=="string" || data.message.length>500 || !validAppeal(cleanText(data.message),500,1) || typeof data.requestId!=="string" || !uuid.test(data.requestId))return json({error:"Enter 1–500 characters of plain text. Omit links or harmful language."},400);
  const db=env.DB;if(!db)return unavailable();
  const now=Date.now(),message=cleanText(data.message),id=data.requestId;
  try{
    await db.prepare(`INSERT OR IGNORE INTO account_feedback(id,subject,message,created)
      SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM account_feedback WHERE subject=? AND created>?)<8
      AND NOT EXISTS(SELECT 1 FROM account_feedback WHERE subject=? AND message=? COLLATE NOCASE AND created>?)
      AND NOT EXISTS(SELECT 1 FROM account_closures WHERE subject=?)`).bind(id,user.subject,message,now,user.subject,now-day,user.subject,message,now-600000,user.subject).run();
    const record=await db.prepare("SELECT id,subject,message,created,delivery FROM account_feedback WHERE subject=? AND (id=? OR (message=? COLLATE NOCASE AND created>?)) ORDER BY (id=?) DESC LIMIT 1")
      .bind(user.subject,id,message,now-600000,id).first<Omit<Notice,"kind">>();
    if(!record)return json({error:"Feedback is limited to eight messages in 24 hours. Try again later."},429);
    if(record.id===id && record.message!==message)return json({error:"Start a new message to send different feedback."},409);
    const notice:Notice={...record,kind:"feedback"};
    const delivery=await notifyOwner(env,notice);
    return json({ok:true,delivery,emailDraft:delivery==="inbox"?draftEmail(env,notice):undefined});
  }catch{return unavailable();}
}

export async function accountHistory(request:Request,env:FeedbackEnv){
  const user=await principal(request);if(!user)return unauthorized();
  const db=env.DB;if(!db)return unavailable();
  const page=Math.min(1000,Math.max(0,Math.floor(Number(new URL(request.url).searchParams.get("page"))||0)));
  try{
    const {results}=await db.prepare(`WITH restrictions AS (
      SELECT b.subject,b.blocked_at,b.released_at FROM moderation_blocks b WHERE b.subject=?1 OR
        (b.released_at IS NULL AND EXISTS(SELECT 1 FROM moderation_contacts c WHERE c.subject=b.subject
          AND (c.email_key=?2 OR c.email_key IN (SELECT email_key FROM moderation_contacts WHERE subject=?1))))
    ) SELECT * FROM (
      SELECT id,created,'Feedback' AS type,CASE WHEN delivery='emailed' THEN 'Email accepted' ELSE 'In developer inbox' END AS status,message AS detail FROM account_feedback WHERE subject=?1
      UNION ALL SELECT id,created,'Account review',status,message FROM moderation_appeals WHERE subject=?1
      UNION ALL SELECT id,created,'Policy report','Recorded',reason FROM moderation_reports WHERE subject=?1
      UNION ALL SELECT 'restriction-'||blocked_at,blocked_at,'Account restriction','Restricted','Access restricted' FROM restrictions
      UNION ALL SELECT 'release-'||released_at,released_at,'Account restriction','Restored','Access restored' FROM restrictions WHERE released_at IS NOT NULL
    ) ORDER BY created DESC,id LIMIT 51 OFFSET ?3`).bind(user.subject,user.mail,page*50).all();
    return json({rows:results.slice(0,50),hasMore:results.length>50});
  }catch{return unavailable();}
}
export async function reviewerInbox(request:Request,env:FeedbackEnv){
  if(!isReviewer(request,env))return json({error:"Reviewer access required."},403);
  const db=env.DB;if(!db)return unavailable();
  try{
    const {results}=await db.prepare(`SELECT * FROM (
      SELECT id,subject,message,created,delivery,'feedback' AS kind FROM account_feedback
      UNION ALL SELECT id,subject,NULL,created,delivery,'deletion' FROM account_closures
    ) ORDER BY created DESC LIMIT 150`).all();
    return json({records:results});
  }catch{return unavailable();}
}
