import {activeBlock,boundedJson,json,principal,type ModEnv,unavailable} from "./guard.ts";
import {cleanText,validAppeal} from "./policy.ts";


export async function getAppeal(request:Request,env:ModEnv){
  const p=await principal(request);
  if(!p)return json({signedIn:false,blocked:false});
  const db=env.DB;if(!db)return unavailable();
  try {
    const block=await activeBlock(db,p);
    const last=block?await db.prepare("SELECT status,created FROM moderation_appeals WHERE subject=? AND block_subject=? AND created>=? ORDER BY created DESC LIMIT 1")
      .bind(p.subject,block.subject,block.blocked_at).first<{status:string;created:number}>():null;
    return json({signedIn:true,blocked:!!block,last});
  }catch{return unavailable();}
}
export async function postAppeal(request:Request,env:ModEnv){
  const p=await principal(request);
  if(!p)return json({error:"Sign in to submit an appeal."},401);
  const data=await boundedJson(request,7000);
  if(!data || !validAppeal(data.message,1000,12) || !validAppeal(data.documentation,500))
    return json({error:"Use 12–1,000 characters for your comments and up to 500 for supporting details. Use plain text and omit links or harmful terms."},400);
  const db=env.DB;if(!db)return unavailable();
  try {
    const block=await activeBlock(db,p);
    if(!block)return json({error:"There is no active restriction on this account."},409);
    const now=Date.now();
    const result=await db.prepare(`INSERT OR IGNORE INTO moderation_appeals(id,subject,block_subject,message,documentation,created,day)
      SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM moderation_appeals WHERE subject=? AND block_subject=? AND status='pending')
      RETURNING id`).bind(crypto.randomUUID(),p.subject,block.subject,cleanText(data.message),cleanText(data.documentation),
        now,Math.floor(now/86400000),p.subject,block.subject).first<{id:string}>();
    return result?json({accepted:true},201):json({error:"A review is pending, or you have already submitted an appeal today."},429);
  }catch{return unavailable();}
}
