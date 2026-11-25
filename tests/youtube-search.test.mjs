import assert from "node:assert/strict";
import {test} from "node:test";
import {youtubeTerms} from "../app/musicSearch.ts";
import {parseFeed,youtubeMatches} from "../app/api/youtube-search/provider.ts";
import {database} from "./sqlite-fixture.mjs";
const spec={query:"",mood:"",genre:"",activity:""};
const feed='<feed xmlns="http://www.w3.org/2005/Atom"><entry><yt:videoId>Abc123Def_1</yt:videoId><title>Pulse &amp; Drift · Deep House Study Mix</title><media:description>Upbeat instrumental tunes for work.</media:description></entry></feed>';

test("typed YouTube search preserves the phrase and includes the chosen filters",()=>{
  assert.equal(youtubeTerms({...spec,query:"Bonobo & friends"}),"Bonobo & friends");
  assert.equal(youtubeTerms({...spec,genre:"Deep house",activity:"Study"}),"Deep house Study focus music");
  assert.match(youtubeTerms({...spec,activity:"Sprint mode"}),/driving house/);
});
test("official YouTube music feed matches are playable, screened, and cached",async t=>{
  const parsed=parseFeed(feed,"Jason Lewis · Mind Amend","Electronic");
  assert.equal(parsed[0].title,"Pulse & Drift · Deep House Study Mix");
  assert.equal(parsed[0].genre,"Deep house");
  assert.equal(parseFeed(feed.replace("Abc123Def_1","invalid"),"Studio","Electronic").length,0);
  const mocked=t.mock.method(globalThis,"fetch",async url=>{
    assert.equal(new URL(url).hostname,"www.youtube.com");
    return new Response(feed);
  });
  const result=await youtubeMatches({...spec,query:"Pulse"},{},new AbortController().signal);
  assert.equal(result.source,"channels");assert.equal(result.tracks.length,1);
  await youtubeMatches({...spec,query:"Drift"},{},new AbortController().signal);
  assert.equal(mocked.mock.callCount(),3);
});
test("keyed lookup requests embeddable YouTube hits and caches submissions",async t=>{
  const calls=t.mock.method(globalThis,"fetch",async(url,init)=>{
    assert.equal(url.searchParams.get("q"),"Moonlit jazz");
    assert.equal(url.searchParams.get("videoEmbeddable"),"true");
    assert.equal(url.searchParams.get("safeSearch"),"strict");
    assert.equal(init.headers["X-Goog-Api-Key"],"example");
    return Response.json({items:[{id:{videoId:"zZz123abCDE"},snippet:{title:"Moonlit jazz",channelTitle:"Studio",description:"A late jazz set"}}]});
  });
  const query={...spec,query:"Moonlit jazz"};
  const {DB,raw}=database();t.after(()=>raw.close());
  const access={key:"example",subject:"reader",db:DB};
  const result=await youtubeMatches(query,access,new AbortController().signal);
  assert.equal(result.source,"youtube");assert.equal(result.tracks[0].artist,"Studio");
  assert.equal(result.tracks[0].id,"zZz123abCDE");
  await youtubeMatches(query,{...access,subject:"second-reader"},new AbortController().signal);assert.equal(calls.mock.callCount(),1);
  assert.equal(raw.prepare("SELECT count(*) n FROM provider_calls").get().n,1);
});
