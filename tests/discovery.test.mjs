import "../scripts/node-worker-test-env.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import {database} from "./sqlite-fixture.mjs";

test("discovery requests scoped previews and handles a book-service outage",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());

  const original=globalThis.fetch;
  const queries=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==="string" || input instanceof URL ? input : input.url);
    queries.push(url);
    if(url.hostname==="www.googleapis.com") return new Response(null,{status:429});
    if(url.hostname==="en.wikipedia.org")return Response.json({query:{pages:[{title:"Reading",fullurl:"https://en.wikipedia.org/wiki/Reading",extract:"A preview.",index:1}]}});
    throw Error("Unexpected host");
  };
  try {
    const worker=(await import("../dist/server/index.js")).default;
    const response=await worker.fetch(new Request("http://localhost/api/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:"reading"})}),{DB,ASSETS:{fetch:async()=>new Response(null,{status:404})}},{waitUntil(){},passThroughOnException(){}});
    const result=await response.json();
    assert.equal(response.status,200);
    assert.equal(result.unavailable,1);
    assert.equal(result.items[0].summary,"A preview.");
    assert.equal(result.answer.kind,"Source notes");
    assert.equal(result.answer.sources[0].url,"https://en.wikipedia.org/wiki/Reading");
    assert.ok(queries.some(url=>url.searchParams.get("q")==="neurodiversity reading"));
  }finally{globalThis.fetch=original;}
});

test("each visit offers three distinct prompts and rotates past the last visit",async()=>{
  const {pickVisitQuestions,suggestedQuestions}=await import("../app/resources.ts");
  const first=pickVisitQuestions([],()=>0);
  const next=pickVisitQuestions(first,()=>.99);
  for(const choices of [first,next]){
    assert.equal(choices.length,3);
    assert.equal(new Set(choices).size,3);
    assert.ok(choices.every(q=>suggestedQuestions.includes(q)));
  }
  assert.ok(next.every(q=>!first.includes(q)));
});

test("shelf and featured artwork belongs to the listed publication",async()=>{
  const {starters,featuredArticles}=await import("../app/resources.ts");
  const {existsSync}=await import("node:fs");
  assert.ok(starters.every(r=>r.image));
  assert.ok(featuredArticles.every(r=>r.image));
  assert.match(starters[0].image,/content\.health\.harvard\.edu\//);
  const masking=featuredArticles.find(r=>r.title==="Masking");
  assert.equal(masking.imageCredit,masking.url);
  for(const resource of featuredArticles.filter(r=>r.image.startsWith("/resource-art/"))){
    assert.ok(existsSync(new URL("../public"+resource.image,import.meta.url)));
  }
});
test("book artwork preserves cover, edition and ISBN alternatives and omits placeholders",async()=>{
  const {openLibraryImages,imageList,sourceArtworkKey,artworkSignature}=await import("../app/resourceImages.ts");
  const images=openLibraryImages({cover_i:100,cover_edition_key:"OL71M",isbn:["9780399185618","9780399185618"]});
  assert.equal(images.length,3);
  assert.ok(images.every(url=>url.endsWith("?default=false")));
  assert.deepEqual(openLibraryImages({cover_i:-1,cover_edition_key:"OL7W",isbn:["n/a"]}),[]);
  assert.deepEqual(imageList(undefined,images[0],images[0]),[images[0]]);
  assert.deepEqual(sourceArtworkKey("https://openlibrary.org/works/OL20W/book"),{provider:"openlibrary",id:"OL20W"});
  assert.deepEqual(sourceArtworkKey("https://en.wikipedia.org/wiki/Autism"),{provider:"wikipedia",id:"Autism"});
  assert.equal(sourceArtworkKey("https://example.com/works/OL20W"),null);
  assert.equal(sourceArtworkKey("https://en.wikipedia.org/wiki/File:test"),null);
  assert.notEqual(artworkSignature({url:"/a",title:"Reading"}),artworkSignature({url:"/b",title:"Reading"}));
});
