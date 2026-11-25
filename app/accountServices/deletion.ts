import {boundedJson,json,principal,unavailable,type ModEnv} from "../moderation/guard.ts";
import {notifyOwner,type Notice,type FeedbackEnv} from "./notifications.ts";

/** The platform identity survives deletion of the reader profile. Block stale documents
 * and signed-in API writes without interfering with sign-out or the appeal process. */
export async function deletedBoundary(request:Request,env:ModEnv):Promise<Response|null>{
  const path=new URL(request.url).pathname.replace(/\/+$/,"") || "/";
  if(path==="/account-deleted" || path==="/api/account/profile" || path==="/api/account/history" || path==="/api/account/status" || path==="/appeal" ||
    path==="/moderation" || path.startsWith("/api/moderation/") || path.startsWith("/_next/") || path.startsWith("/assets/") ||
    path.startsWith("/_vinext/") || ["/callback","/signin-with-chatgpt","/signout-with-chatgpt","/favicon.svg","/favicon.ico"].includes(path))return null;
  const owner=request.headers.get("oai-authenticated-user-id");
  if(!owner)return null;
  if(!env.DB)return unavailable();
  try{
    const closed=await env.DB.prepare("SELECT 1 FROM account_closures WHERE subject=?").bind(owner).first();
    if(!closed)return null;
    if(path.startsWith("/api/"))return json({error:"This reader profile was deleted.",code:"profile_deleted",owner},410);
    return new Response(null,{status:303,headers:{Location:"/account-deleted","Cache-Control":"private, no-store"}});
  }catch{return unavailable();}
}
export async function deleteProfile(request:Request,env:FeedbackEnv){
  const user=await principal(request);
  if(!user)return json({error:"Sign in to delete your reader profile."},401);
  const data=await boundedJson(request,2000);
  if(!data || data.expectedUser!==user.subject || data.confirmation!=="DELETE")return json({error:"Confirm this reader profile by entering DELETE."},400);
  const db=env.DB;if(!db)return unavailable();
  try{
    const subject=user.subject;
    const noticeId=crypto.randomUUID();
    // Gate every erase on the winning receipt. A retried DELETE must not erase
    // an appeal the user submitted after the first closure completed.
    const winningReceipt="EXISTS(SELECT 1 FROM account_closures WHERE subject=? AND id=?)";
    const erase=(sql:string,...args:string[])=>db.prepare(sql+" AND "+winningReceipt).bind(...args,subject,noticeId);
    const retainActive=`EXISTS(SELECT 1 FROM moderation_blocks b
      WHERE b.released_at IS NULL AND (b.subject=? OR b.subject IN (
        SELECT c.subject FROM moderation_contacts c WHERE c.email_key IN (
          SELECT self.email_key FROM moderation_contacts self WHERE self.subject=?))))`;
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO account_closures(subject,id,created) VALUES(?,?,?)").bind(subject,noticeId,Date.now()),
      erase("DELETE FROM music_profiles WHERE user_id=?",subject),
      erase("DELETE FROM reader_preferences WHERE user_id=?",subject),
      erase("DELETE FROM account_activity WHERE subject=?",subject),
      erase("DELETE FROM account_feedback WHERE subject=?",subject),
      erase("DELETE FROM moderation_appeals WHERE subject=?",subject),
      erase("DELETE FROM moderation_reports WHERE subject=?",subject),
      erase("DELETE FROM moderation_blocks WHERE subject=? AND released_at IS NOT NULL",subject),
      erase("DELETE FROM moderation_contacts WHERE subject=? AND NOT "+retainActive,subject,subject,subject),
    ]);
    const receipt=await db.prepare("SELECT id,subject,created,delivery FROM account_closures WHERE subject=?")
      .bind(subject).first<Omit<Notice,"kind">>();
    if(!receipt)return unavailable();
    const delivery=await notifyOwner(env,{...receipt,kind:"deletion"});
    return json({ok:true,delivery});
  }catch{return unavailable();}
}
