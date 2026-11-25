import test from "node:test";
import assert from "node:assert/strict";
import {publicArticle} from "../app/articleUrl.ts";
import {extractPassage,importArticle} from "../app/api/read-link/importer.ts";

const guide="https://techpp.com/2023/06/27/bionic-reading-guide/";
const paragraph="Readers can compare a paragraph in two formats and adjust the emphasis to their own preference. ";
test("only supported public article paths are fetched and tracking parameters are removed",()=>{
  assert.equal(publicArticle(guide+"?tracking=demo#more").href,guide);
  for(const url of ["http://techpp.com/example","https://techpp.com/account","https://example.com/news","https://name@techpp.com/2023/06/27/guide/"])assert.equal(publicArticle(url),null);
});
test("previews contain plain paragraphs and headings inside the article",()=>{
  const result=extractPassage('<title>Guide</title><nav>Home</nav><article><h1>My guide</h1><div class="entry-content"><p>'+paragraph+'<strong>One &amp; two.</strong></p><h2>Next section</h2><p>'+paragraph+'</p><aside><p>Subscribe</p></aside></div></article>',new URL(guide));
  assert.equal(result.title,"My guide");assert.ok(result.text.includes("One & two.\n\nNext section"));
  assert.doesNotMatch(result.text,/Subscribe|Home|<strong>/);
});
test("the importer stops on an unsupported redirect or an oversized document",async()=>{
  const signal=new AbortController().signal;
  let calls=0;
  await assert.rejects(importArticle(publicArticle(guide),signal,async()=>{calls++;return new Response(null,{status:302,headers:{Location:"https://example.org/"}});}),/public article/);
  assert.equal(calls,1);
  await assert.rejects(importArticle(publicArticle(guide),signal,async()=>new Response("a".repeat(2000001),{headers:{"Content-Type":"text/html"}})),/too large/);
});
