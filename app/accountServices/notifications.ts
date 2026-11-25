import type {ModEnv} from "../moderation/guard.ts";

export type FeedbackEnv=ModEnv & {RESEND_API_KEY?:string;FEEDBACK_FROM_EMAIL?:string;PUBLIC_FEEDBACK_EMAIL?:string};
export type Notice={id:string;subject:string;created:number;delivery:"inbox"|"emailed";message?:string;kind:"feedback"|"deletion"};
function recipient(env:FeedbackEnv){
  const email=env.MODERATION_OWNER_EMAIL?.trim();
  return email && /^[^\s<>,;?&@]+@[^\s<>,;?&@]+\.[^\s<>,;?&@]+$/.test(email)?email:undefined;
}
export function draftEmail(env:FeedbackEnv,notice:Notice){
  const to=env.PUBLIC_FEEDBACK_EMAIL?.trim();
  if(!to || !/^[^\s<>,;?&@]+@[^\s<>,;?&@]+\.[^\s<>,;?&@]+$/.test(to) || notice.kind!=="feedback")return undefined;
  return "mailto:"+to+"?subject="+encodeURIComponent("Neurotype Reader feedback")+"&body="+encodeURIComponent(notice.message || "");
}
export async function notifyOwner(env:FeedbackEnv,notice:Notice,send:typeof fetch=fetch):Promise<"inbox"|"emailed">{
  if(notice.delivery==="emailed")return "emailed";
  const to=recipient(env);
  if(!env.DB || !env.RESEND_API_KEY || !env.FEEDBACK_FROM_EMAIL || !to)return "inbox";
  const message=notice.kind==="feedback"?notice.message:"The reader deleted their Neurotype profile.";
  const title=notice.kind==="feedback"?"New feedback":"Profile deleted";
  try{
    const result=await send("https://api.resend.com/emails",{method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+env.RESEND_API_KEY,"Idempotency-Key":"reader-"+notice.kind+"-"+notice.id},
      body:JSON.stringify({from:env.FEEDBACK_FROM_EMAIL,to:[to],subject:"Neurotype Reader · "+title,
        text:message+"\n\nReceipt "+notice.id+"\n"+new Date(notice.created).toISOString()}),
      signal:AbortSignal.timeout(6000)});
    if(!result.ok || !(await result.json() as {id?:string}).id)return "inbox";
    const table=notice.kind==="feedback"?"account_feedback":"account_closures";
    await env.DB.prepare("UPDATE "+table+" SET delivery='emailed' WHERE id=?").bind(notice.id).run();
    return "emailed";
  }catch{return "inbox";}
}
