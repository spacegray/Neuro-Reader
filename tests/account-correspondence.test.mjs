import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {feedback,accountHistory,reviewerInbox} from "../app/accountServices/correspondence.ts";
import {deleteProfile,deletedBoundary} from "../app/accountServices/deletion.ts";
import {notifyOwner} from "../app/accountServices/notifications.ts";

function setup(t){
  const raw=new DatabaseSync(":memory:");
  t.after(()=>raw.close());
  const directory=new URL("../drizzle/",import.meta.url);
  for(const file of readdirSync(directory).filter(name=>name.endsWith(".sql")).sort()){
    raw.exec(readFileSync(new URL(file,directory),"utf8"));
  }
  function prepare(sql,values=[]){
    const statement=raw.prepare(sql);
    return {bind:(...args)=>prepare(sql,args),first:async()=>statement.get(...values)??null,
      all:async()=>({results:statement.all(...values)}),run:async()=>statement.run(...values)};
  }
  const DB={prepare,batch:async(statements)=>{
    raw.exec("BEGIN");
    try{for(const s of statements)await s.run();raw.exec("COMMIT");}
    catch(error){raw.exec("ROLLBACK");throw error;}
  }};
  return {raw,env:{DB,MODERATION_OWNER_EMAIL:"dev@example.test"}};
}
function request(path,id="reader",body=null,method=body?"POST":"GET",origin="https://reader.test"){
  const headers=new Headers({"Content-Type":"application/json",origin});
  if(id){
    headers.set("oai-authenticated-user-id",id);
    headers.set("oai-authenticated-user-email",id+"@example.test");
  }
  return new Request("https://reader.test"+path,{method,headers,body:body?JSON.stringify(body):undefined});
}
const feedbackPath="/api/account/feedback";
const profilePath="/api/account/profile";
const historyPath="/api/account/history";
const adminPath="/api/moderation/correspondence";
test("feedback enforces subject, bounds and origin, deduplicates retries, keeps a private inbox and supplies a draft",async t=>{
  const {raw,env}=setup(t);
  const note={message:"The new controls are easy to find & use.",requestId:crypto.randomUUID()};
  assert.equal((await feedback(request(feedbackPath,"",note),env)).status,401);
  assert.equal((await feedback(request(feedbackPath,"reader",note,"POST","https://another.test"),env)).status,400);
  for(const message of [" ", "x".repeat(501), "ﷺ".repeat(100), "<iframe>", "https://example.test"]){
    assert.equal((await feedback(request(feedbackPath,"reader",{...note,message}),env)).status,400);
  }
  for(let retry=0;retry<2;retry++){
    const r=await feedback(request(feedbackPath,"reader",note),env);
    const response=await r.json();
    assert.equal(r.status,200);
    assert.equal(response.delivery,"inbox");
    assert.equal(response.emailDraft,undefined);
  }
  assert.equal(raw.prepare("SELECT COUNT(*) c FROM account_feedback").get().c,1);
  assert.equal((await feedback(request(feedbackPath,"reader",{...note,message:"An unrelated message."}),env)).status,409);
  assert.equal((await (await accountHistory(request(historyPath),env)).json()).rows[0].detail,note.message);
  assert.deepEqual((await (await accountHistory(request(historyPath,"other"),env)).json()).rows,[]);
  assert.equal((await reviewerInbox(request(adminPath),env)).status,403);
  assert.equal((await (await reviewerInbox(request(adminPath,"dev"),env)).json()).records.length,1);
  const duplicate=await feedback(request(feedbackPath,"reader",{...note,requestId:crypto.randomUUID()}),{...env,PUBLIC_FEEDBACK_EMAIL:"support@example.test"});
  assert.equal(new URL((await duplicate.json()).emailDraft).pathname,"support@example.test");
  assert.equal(raw.prepare("SELECT COUNT(*) c FROM account_feedback").get().c,1);
  for(let i=0;i<7;i++)assert.equal((await feedback(request(feedbackPath,"reader",{message:"Another note "+i,requestId:crypto.randomUUID()}),env)).status,200);
  assert.equal((await feedback(request(feedbackPath,"reader",{message:"New feedback",requestId:crypto.randomUUID()}),env)).status,429);
  assert.equal((await feedback(request(feedbackPath,"reader",note),env)).status,200);
});
test("provider acceptance is recorded only after a successful response, using stable idempotency",async t=>{
  const {env}=setup(t),id=crypto.randomUUID();
  await feedback(request(feedbackPath,"reader",{requestId:id,message:"Test feedback."}),env);
  const notice={id,subject:"reader",message:"Test feedback.",created:Date.now(),delivery:"inbox",kind:"feedback"};
  const options={...env,RESEND_API_KEY:"dummy-test-only",FEEDBACK_FROM_EMAIL:"reader@example.test"};
  assert.equal(await notifyOwner(options,notice,async()=>new Response(null,{status:429})),"inbox");
  const result=await notifyOwner(options,notice,async(url,init)=>{
    assert.equal(url,"https://api.resend.com/emails");
    assert.equal(init.headers["Idempotency-Key"],"reader-feedback-"+id);
    assert.deepEqual(JSON.parse(init.body).to,["dev@example.test"]);
    return Response.json({id:"simulated"});
  });
  assert.equal(result,"emailed");
  assert.equal((await (await accountHistory(request(historyPath),env)).json()).rows[0].status,"Email accepted");
});
test("profile closure is scoped, atomic, retryable and blocks stale profile writes while preserving active restrictions",async t=>{
  const {raw,env}=setup(t);
  for(const id of ["reader","other"]){
    raw.prepare("INSERT INTO music_profiles VALUES(?,1,'{}')").run(id);
    raw.prepare("INSERT INTO reader_preferences VALUES(?,1,'{}')").run(id);
    raw.prepare("INSERT INTO account_activity(subject,last_seen) VALUES(?,0)").run(id);
    raw.prepare("INSERT INTO moderation_contacts VALUES(?,?)").run(id,id+"-key");
    await feedback(request(feedbackPath,id,{requestId:crypto.randomUUID(),message:"Hello!"}),env);
  }
  raw.prepare("INSERT INTO moderation_blocks VALUES('reader',1,NULL)").run();
  raw.prepare("INSERT INTO moderation_appeals(id,subject,block_subject,message,documentation,created,day) VALUES('old','reader','reader','Old appeal','',10,0)").run();
  const data={confirmation:"DELETE",expectedUser:"reader"};
  assert.equal((await deleteProfile(request(profilePath,"other",data,"DELETE"),env)).status,400);
  assert.equal((await deleteProfile(request(profilePath,"reader",{...data,confirmation:""},"DELETE"),env)).status,400);
  assert.equal((await deleteProfile(request(profilePath,"reader",data,"DELETE","https://another.test"),env)).status,400);
  assert.equal((await deleteProfile(request(profilePath,"reader",data,"DELETE"),env)).status,200);
  raw.prepare("INSERT INTO moderation_appeals(id,subject,block_subject,message,documentation,created,day) VALUES('after','reader','reader','Review my restriction','',11,1)").run();
  assert.equal((await deleteProfile(request(profilePath,"reader",data,"DELETE"),env)).status,200);
  assert.equal(raw.prepare("SELECT id FROM moderation_appeals").get().id,"after");
  for(const [table,col] of [["music_profiles","user_id"],["reader_preferences","user_id"],["account_activity","subject"],["account_feedback","subject"]]){
    assert.equal(raw.prepare("SELECT "+col+" AS owner FROM "+table).get().owner,"other");
    assert.equal(raw.prepare("SELECT COUNT(*) c FROM "+table).get().c,1);
  }
  assert.equal(raw.prepare("SELECT COUNT(*) c FROM account_closures").get().c,1);
  assert.equal(raw.prepare("SELECT subject FROM moderation_blocks WHERE released_at IS NULL").get().subject,"reader");
  assert.equal(raw.prepare("SELECT COUNT(*) c FROM moderation_contacts").get().c,2);
  assert.throws(()=>raw.prepare("INSERT INTO music_profiles VALUES('reader',1,'{}')").run(),/closed/);
  assert.throws(()=>raw.prepare("INSERT INTO reader_preferences VALUES('reader',1,'{}')").run(),/closed/);
  assert.equal((await deletedBoundary(request("/"),env)).headers.get("Location"),"/account-deleted");
  assert.equal((await deletedBoundary(request("/api/music-profile"),env)).status,410);
  assert.equal(await deletedBoundary(request("/","other"),env),null);
  const admin=await (await reviewerInbox(request(adminPath,"dev"),env)).json();
  assert.equal(admin.records.filter(x=>x.kind==="deletion").length,1);
  assert.equal(admin.records.filter(x=>x.kind==="feedback" && x.subject==="reader").length,0);
});
