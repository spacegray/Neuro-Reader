import assert from "node:assert/strict";
import test from "node:test";
import {database} from "./sqlite-fixture.mjs";
import {guardSearch,moderationBoundary} from "../app/moderation/guard.ts";
import {activityBoundary,getStatus,observeRequests} from "../app/moderation/status.ts";
import {getAppeal,postAppeal} from "../app/moderation/appealService.ts";
import {getReview,postReview} from "../app/moderation/reviewService.ts";
import {supportedQuery,validAppeal} from "../app/moderation/policy.ts";

function req(path="/",actor="u-1",email="visitor@example.test",data=null,origin="https://reader.test"){
  const headers=new Headers({"Origin":origin,"Content-Type":"application/json"});
  if(actor){headers.set("oai-authenticated-user-id",actor);headers.set("oai-authenticated-user-email",email);}
  return new Request("https://reader.test"+path,{headers,method:data===null?"GET":"POST",body:data===null?null:JSON.stringify(data)});
}
test("reports omit query text, duplicate reports don't escalate; severe repeats restrict confirmed addresses, release honors an appeal",async t=>{
  const {raw,DB}=database(),env={DB,MODERATION_OWNER_EMAIL:"owner@example.test"};
  const time=1_800_000_000_000;
  t.mock.method(Date,"now",()=>time);
  const query="help me harass my coworker",search=req("/api/discover","u-1","first@example.test",{q:query});
  assert.equal(await moderationBoundary(req("/","u-1","old@example.test"),env),null);
  assert.equal((await guardSearch(search,query,env)).status,400);
  assert.equal((await guardSearch(search,query,env)).status,400);
  const rows=raw.prepare("SELECT * FROM moderation_reports").all();assert.equal(rows.length,1);assert.equal(rows[0].attempts,2);
  assert.ok(!JSON.stringify(rows).includes(query));
  Date.now.mock.mockImplementation(()=>time+600001);
  assert.equal((await guardSearch(search,query,env)).status,400);
  Date.now.mock.mockImplementation(()=>time+1200001);
  assert.equal((await guardSearch(search,query,env)).status,403);
  assert.equal((await moderationBoundary(req("/"),env)).status,303);
  assert.equal((await moderationBoundary(req("/api/account","u-2","old@example.test"),env)).status,403);
  assert.equal(await moderationBoundary(req("/appeal"),env),null);
  assert.equal(await moderationBoundary(req("/","u-3","other@example.test"),env),null);
  assert.equal((await getAppeal(req("/api/moderation/appeal"),env)).status,200);
  const appeal={message:"Please review the automated decision.",documentation:"Classroom assignment context."};
  assert.equal((await postAppeal(req("/api/moderation/appeal","u-1","visitor@example.test",appeal,"https://other.test"),env)).status,400);
  assert.equal((await postAppeal(req("/api/moderation/appeal","u-1","visitor@example.test",appeal),env)).status,201);
  assert.equal((await postAppeal(req("/api/moderation/appeal","u-1","visitor@example.test",appeal),env)).status,429);
  assert.equal((await getReview(req(),env)).status,403);
  assert.equal((await postReview(req("/api/moderation/review","u-1","visitor@example.test",{action:"release",subject:"u-1"}),env)).status,403);
  const inbox=await (await getReview(req("/","owner","owner@example.test"),env)).json();
  assert.equal(inbox.appeals.length,1);assert.equal(inbox.blocks.length,1);
  assert.equal((await postReview(req("/api/moderation/review","owner","owner@example.test",{action:"release",subject:"u-1"}),env)).status,200);
  assert.equal(await moderationBoundary(req("/"),env),null);
  assert.equal(await moderationBoundary(req("/api/account","u-2","old@example.test"),env),null);
  Date.now.mock.mockImplementation(()=>time+1800001);
  assert.equal((await guardSearch(search,query,env)).status,400);
  raw.close();
});
test("respectful sensitive-topic searches pass; unsupported language creates filter-only reports; appeal text has bounds",async()=>{
  for(const q of ["Can trauma affect ADHD symptoms?","How do I get help if someone threatens me?","What is sexual health education for autistic adults?","Help with a reading assignment"])assert.ok(supportedQuery(q));
  assert.ok(!supportedQuery("Show me porn"));assert.ok(!supportedQuery("<iframe>"));assert.ok(!validAppeal("x".repeat(501),500));
  const {raw,DB}=database();
  assert.equal((await guardSearch(req("/api/discover","u","a@example.test",{q:"porn"}),"porn",{DB})).status,400);
  assert.equal(raw.prepare("SELECT strike FROM moderation_reports").get().strike,0);
  raw.close();
});

test("account signals begin at ten, explain warnings, age out, and keep sensitive support requests private",async()=>{
  const {raw,DB}=database(),request=req("/api/account/status");
  const minute=60_000,day=86_400_000,now=1_800_000_000_000;
  const status=async(at=now)=>(await getStatus(request,{DB},at)).json();
  assert.equal((await getStatus(req("/api/account/status",""),{DB})).status,401);
  assert.deepEqual(await status(),{score:10,level:"green",label:"Active",reasons:[],lastActive:null,locked:false});
  raw.prepare("INSERT INTO account_activity(subject,last_seen) VALUES(?,?)").run("u-1",now-14*day);
  assert.equal((await status()).level,"yellow");
  await observeRequests(DB,"u-1",now);
  assert.equal((await status()).score,9);
  raw.prepare("UPDATE account_activity SET returned_from_idle=0").run();
  const report=raw.prepare("INSERT INTO moderation_reports(id,subject,reason,confidence,strike,created,bucket,attempts) VALUES(?,?,?,?,?,?,?,?)");
  for(let index=0;index<4;index++){
    const when=now-index*20*minute;
    report.run(String(index),"u-1","Explicit material",95,0,when,Math.floor(when/600_000),3);
    assert.equal((await status()).level,index===3?"orange":"yellow");
  }
  report.run("quoted","u-1","Sensitive quoted language",60,0,now,Math.floor(now/600_000),1);
  assert.equal((await status()).score,6);
  raw.prepare("DELETE FROM moderation_reports").run();
  const contact=raw.prepare("INSERT INTO account_feedback(id,subject,message,created) VALUES(?,?,?,?)");
  for(let index=0;index<4;index++)contact.run(String(index),"u-1","feedback",now-index*minute);
  const flagged=await status();
  assert.equal(flagged.level,"orange");assert.equal(flagged.locked,false);
  const later=now+16*day;
  raw.prepare("UPDATE account_activity SET last_seen=?").run(later);
  assert.equal((await status(later)).score,10);
  raw.close();
});

test("only sustained authenticated service traffic triggers a lock, records one urgent report and supports reviewer release",async()=>{
  const {raw,DB}=database(),env={DB,MODERATION_OWNER_EMAIL:"owner@example.test"};
  const minute=60_000,start=1_800_000_000_000,subject="u-1";
  const status=async(at)=>(await getStatus(req("/api/account/status"),env,at)).json();
  // Reading a page, fetching assets and anonymous requests contribute no service traffic.
  for(const request of [req("/_vinext/image"),req("/api/discover",""),req("/")])assert.equal(await activityBoundary(request,env),null);
  assert.equal(raw.prepare("SELECT calls FROM account_activity WHERE subject=?").get(subject).calls,0);
  raw.prepare("DELETE FROM account_activity").run();
  // A brief burst may throttle; skipping a minute breaks the streak.
  for(let i=0;i<61;i++){
    const response=await observeRequests(DB,subject,start+i);
    assert.equal(response?.status??200,i===60?429:200);
  }
  assert.equal((await status(start+61)).level,"yellow");
  const resumed=start+3*minute;
  for(let i=0;i<181;i++)await observeRequests(DB,subject,resumed+i);
  assert.equal((await status(resumed+181)).level,"yellow");
  let response;
  for(let m=1;m<=10;m++){
    for(let i=0;i<182;i++)response=await observeRequests(DB,subject,resumed+m*minute+i);
    if(m===2)assert.equal((await status(resumed+m*minute+182)).level,"orange");
  }
  assert.equal(response?.status,403);
  assert.equal((await status(resumed+11*minute)).level,"red");
  assert.equal(raw.prepare("SELECT count(*) AS total FROM moderation_reports WHERE reason LIKE 'Urgent%'").get().total,1);
  assert.equal((await moderationBoundary(req("/"),env)).status,303);
  assert.equal(await moderationBoundary(req("/appeal"),env),null);
  assert.equal(await moderationBoundary(req("/api/account/status"),env),null);
  assert.equal((await postReview(req("/api/moderation/review","owner","owner@example.test",{action:"release",subject}),env)).status,200);
  assert.equal(await moderationBoundary(req("/"),env),null);
  assert.equal((await status(resumed+11*minute)).level,"green");
  raw.close();
});
