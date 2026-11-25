import assert from "node:assert/strict";
import test from "node:test";
import {database} from "./sqlite-fixture.mjs";
import {requestBoundary,documentPolicy,secureResponse} from "../app/security/http.ts";
import {allowRequest,quotaDay,reserveCall} from "../app/security/limits.ts";
import {youtubeMatches} from "../app/api/youtube-search/provider.ts";

test("guest, reader and reviewer access and same-origin write policy",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());
  const env={DB,MODERATION_OWNER_ID:"reviewer"};
  const req=(path,method="GET",headers={})=>new Request("https://reader.test"+path,{method,headers});
  assert.equal(await requestBoundary(req("/"),env),null);
  assert.equal((await requestBoundary(req("/api/account/history"),env)).status,401);
  assert.equal((await requestBoundary(req("/moderation"),env)).status,403);
  assert.equal((await requestBoundary(req("/api/moderation/review"),env)).status,403);
  assert.equal((await requestBoundary(req("/api/moderation/correspondence","GET",{"oai-authenticated-user-id":"reader"}),env)).status,403);
  assert.equal(await requestBoundary(req("/api/moderation/correspondence","GET",{"oai-authenticated-user-id":"reviewer"}),env),null);
  assert.equal((await requestBoundary(req("/api/music-profile","PUT",{Origin:"https://external.example"}),env)).status,403);
  assert.equal((await requestBoundary(req("/api/youtube-search","POST"),env)).status,415);
  assert.equal((await requestBoundary(req("/api/account","DELETE"),env)).status,405);
  assert.equal((await requestBoundary(req("/api/unknown"),env)).status,404);
  assert.equal((await requestBoundary(req("/api/discover"),{})).status,503);
  const policy=documentPolicy();
  assert.notEqual(policy,documentPolicy());
  const response=secureResponse(req("/"),new Response("reader",{headers:{"Content-Type":"text/html"}}),policy);
  assert.equal(response.headers.get("Content-Security-Policy"),policy);
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");
});

test("shared counters enforce account, site, minute and Pacific day boundaries",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());
  const now=Date.parse("2026-11-24T07:58:00Z");
  assert.notEqual(quotaDay(now),quotaDay(now+180000));
  const account=await Promise.all(Array.from({length:9},()=>reserveCall(DB,"youtube","first","q",now)));
  assert.equal(account.filter(Boolean).length,5);
  for(let u=0;u<15;u++)for(let i=0;i<5;i++)assert.ok(await reserveCall(DB,"youtube","reader"+u,"q",now));
  assert.equal(await reserveCall(DB,"youtube","fresh","q",now),undefined);
  assert.ok(await reserveCall(DB,"youtube","first","q",now+180000));
  for(let i=0;i<3;i++)assert.ok(await allowRequest(DB,"example",240,3));
  assert.equal(await allowRequest(DB,"example",240,3),false);
  assert.ok(await allowRequest(DB,"example",241,3));
});

test("guests and rate-limited accounts retain curated search without using the provider key",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());
  const spec={query:"ambient piano",mood:"",genre:"",activity:""};
  t.mock.method(globalThis,"fetch",async url=>{
    assert.equal(new URL(url).hostname,"www.youtube.com");
    return new Response("<feed></feed>");
  });
  const signal=new AbortController().signal;
  const result=await youtubeMatches(spec,{key:"fixture",db:DB},signal);
  assert.equal(result.reason,"sign-in");assert.equal(result.source,"channels");
  assert.equal(raw.prepare("SELECT count(*) n FROM provider_calls").get().n,0);
  for(let i=0;i<80;i++)await reserveCall(DB,"youtube","u"+i,"other",Date.now());
  assert.equal((await youtubeMatches(spec,{key:"fixture",db:DB,subject:"reader"},signal)).reason,"daily-limit");
});

test("page, provider and inbox limits apply independently and across signed-in accounts",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());
  t.mock.method(Date,"now",()=>Date.UTC(2026,10,24,16,1,10));
  const request=(path,subject,method="GET")=>new Request("https://reader.test"+path,{method,headers:{
    "CF-Connecting-IP":"192.0.2.25","Content-Type":"application/json",...(subject?{"oai-authenticated-user-id":subject}:{})}});
  const boundary=(path,subject,method)=>requestBoundary(request(path,subject,method),{DB});
  for(let i=0;i<60;i++)assert.equal(await boundary("/"),null);
  const limited=await boundary("/");
  assert.equal(limited.status,429);assert.equal(limited.headers.get("Retry-After"),"50");
  assert.equal(await boundary("/api/account"),null);
  for(let i=0;i<20;i++)assert.equal(await boundary("/api/discover"),null);
  assert.equal((await boundary("/api/focus-music")).status,429);
  for(let i=0;i<12;i++)assert.equal(await boundary("/api/account/feedback","reader-"+i,"POST"),null);
  assert.equal((await boundary("/api/moderation/appeal","reader-new","POST")).status,429);
  assert.equal(await boundary("/api/moderation/appeal","reader-new"),null);
  assert.equal((await boundary("/unknown-page")).status,404);
  assert.match(await (await boundary("/robots.txt")).text(),/Disallow: \//);
});
