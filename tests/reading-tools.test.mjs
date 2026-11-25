import assert from "node:assert/strict";
import test from "node:test";
import {sampleCategories,sampleShelf,nextSample} from "../app/readingSamples.ts";
import { scheduledTheme, summarize } from "../app/readingTools.ts";

test("auto switches at local seven o'clock and falls back to Los Angeles", () => {
  for (const zone of ["", "Invalid/City", "America/Los_Angeles"]) {
    assert.equal(scheduledTheme(new Date("2026-11-23T14:59:00Z"), zone), "dark");
    assert.equal(scheduledTheme(new Date("2026-11-23T15:00:00Z"), zone), "light");
    assert.equal(scheduledTheme(new Date("2026-11-24T03:00:00Z"), zone), "dark");
  }
  assert.equal(scheduledTheme(new Date("2026-11-23T15:00:00Z"), "Asia/Tokyo"), "dark");
});

test("summary extracts original statements and topics, including a deadline", () => {
  const text = "We met on Monday. Coffee arrived. The budget deadline is Friday. Submit the budget to finance. Finance reviews the budget. The room was warm.";
  const brief = summarize(text);
  assert.ok(brief.topics.includes("budget"));
  assert.ok(brief.statements.includes("The budget deadline is Friday."));
  assert.ok(brief.statements.every(s => text.includes(s)));
  assert.ok(brief.statements.length < 6);
  assert.deepEqual(summarize(""), { statements: [], topics: [] });
});

test("all sample categories and topics load matching passages and cycle",()=>{
  assert.deepEqual(sampleCategories,["Stories","Poetry","History"]);
  for(const category of ["",...sampleCategories]){
    const entries=sampleShelf.filter(s=>!category || s.category===category);
    for(const topic of ["",...new Set(entries.map(s=>s.topic))]){
      const pool=entries.filter(s=>!topic || s.topic===topic);
      let previous="";
      for(const entry of [...pool,pool[0]]){
        const sample=nextSample(category,topic,previous);
        assert.equal(sample,entry);previous=sample.text;
      }
    }
  }
  assert.equal(nextSample("missing","missing",""),undefined);
});
