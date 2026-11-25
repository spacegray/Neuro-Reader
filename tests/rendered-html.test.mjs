import "../scripts/node-worker-test-env.mjs";
import {database} from "./sqlite-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";

test("renders the About section, research links and creator credit", async t => {
  const {DB,raw}=database();t.after(()=>raw.close());
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      DB, ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  const stats = html.match(/<section[^>]+id="neurodivergence"[\s\S]*?<\/section>/)?.[0];
  assert.ok(stats, "the research section renders on the reader home page");
  assert.equal((stats.match(/class="study-figure"/g) || []).length, 3);
  for (const scope of ["current ADHD diagnosis in 2023", "16 U.S. monitoring sites in 2022",
    "2022 review of 58 studies", "Research gaps and limits", "low-income countries"]) {
    assert.ok(stats.includes(scope), scope);
  }
  for (const fragment of ['href="#about"', 'id="about"', 'About Neurotype Reader',
    'https://www.linkedin.com/in/aylabasha/', '38723450', '40240742', 'article/view/5056', '27580753', 'Study designs and limits', 'Read from a link', '42685589', '10.1002/jcal.70354', 'Explore population estimates', 'Inside the experiment', '85,330', '15.5 million', 'Neurodivergence by the numbers', 'Peaceful Lilac', 'Desert Rose', 'Butter Sky', 'Tide &amp; Espresso', 'Two-tone', 'name="word-color"', 'name="color-profile"', 'Reading library', 'Save read', 'Background fill', 'Summarize']) {
    assert.ok(html.includes(fragment), fragment);
  }
});

test("published worker emits a fresh CSP nonce matching all inline executable scripts",async t=>{
  const {DB,raw}=database();t.after(()=>raw.close());
  const {default:worker}=await import("../dist/server/index.js");
  const response=await worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),
    {DB,ASSETS:{fetch:async()=>new Response(null,{status:404})}},{waitUntil(){}});
  const policy=response.headers.get("Content-Security-Policy");
  const nonce=policy?.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  const html=await response.text();
  const scripts=[...html.matchAll(/<script\b([^>]*)>/gi)].map(match=>match[1])
    .filter(attrs=>!attrs.includes("src=") && !/type="(?:application\/json|application\/ld\+json)"/.test(attrs));
  assert.ok(scripts.length>0);
  assert.ok(scripts.every(attrs=>attrs.includes('nonce="'+nonce+'"')));
});
