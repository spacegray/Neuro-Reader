import assert from "node:assert/strict";
import test from "node:test";
import {tracks} from "../app/musicLibrary.ts";
import {emptyLibrary,historyWindow,markPlayed,readLibrary,recommendations} from "../app/listeningLibrary.ts";
import {nextSample,sampleShelf} from "../app/readingSamples.ts";
test("played shading survives reopening, de-duplicates resumes and expires at 12 hours",()=>{
  const start=1000,first=markPlayed(emptyLibrary(),tracks[0].id,start);
  assert.equal(markPlayed(first,tracks[0].id,start+100),first);
  const lib={...first,favorites:[tracks[1]],mixes:[{id:"one",name:"Study",tracks:[tracks[1]]}]};
  const raw=JSON.stringify(lib);
  assert.deepEqual(readLibrary(raw,start+historyWindow-1),lib);
  assert.deepEqual(readLibrary(raw,start+historyWindow),{...lib,played:[],started:0});
  assert.deepEqual(markPlayed(lib,tracks[1].id,start+historyWindow).played,[tracks[1].id]);
});
test("similar suggestions exclude playlist members and rank complementary music",()=>{
  const similar=recommendations(tracks,[tracks[0]],tracks[0]);
  assert.ok(!similar.some(t=>t.id===tracks[0].id));
  assert.equal(similar[0].genre,tracks[0].genre);
});
test("each sample topic offers a rotation of all-ages passages",()=>{
  for(const sample of sampleShelf){
    const next=nextSample(sample.category,sample.topic,sample.text);
    assert.notEqual(next.text,sample.text);assert.equal(next.topic,sample.topic);
  }
});
