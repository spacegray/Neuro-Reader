import assert from "node:assert/strict";
import test from "node:test";
import {blankCloud,cloudOf,rebaseMusic,validCloud,readPrefs} from "../app/musicProfile.ts";
import {defaults,tracks} from "../app/musicLibrary.ts";

test("syncs collections and filters without search or played history",()=>{
  const local={mixes:[],favorites:[tracks[0]],played:[tracks[0].id],started:Date.now()};
  const payload=cloudOf(local,{...defaults,query:"my private search",mood:"Focus"});
  assert.deepEqual(Object.keys(payload).sort(),["favorites","filters","mixes"]);
  assert.ok(!JSON.stringify(payload).includes("private search"));
  assert.equal(payload.filters.mood,"Focus");
  assert.ok(validCloud(payload));
  assert.equal(readPrefs(JSON.stringify({...defaults,trackId:"x1234567890"})).trackId,"x1234567890");
});
test("combines concurrent edits to a playlist without resurrecting deletions",()=>{
  const mix={id:"one",name:"Old",tracks:[tracks[0],tracks[1]]};
  const base={...blankCloud(),mixes:[mix],favorites:[tracks[0]]};
  const local={...base,mixes:[{...mix,name:"Renamed",tracks:[tracks[1],tracks[2]]}],favorites:[]};
  const remote={...base,mixes:[{...mix,tracks:[tracks[0],tracks[1],tracks[3]]}],favorites:[tracks[0],tracks[4]]};
  const merged=rebaseMusic(base,local,remote);
  assert.equal(merged.mixes[0].name,"Renamed");
  assert.deepEqual(merged.mixes[0].tracks.map(t=>t.id),[tracks[1].id,tracks[3].id,tracks[2].id]);
  assert.deepEqual(merged.favorites,[tracks[4]]);
  assert.equal(rebaseMusic(base,local,blankCloud()).mixes.length,0);
});
test("profile validation rejects duplicate ids, unknown properties and oversized playlist collections",()=>{
  const good={id:"alpha",name:"Focus",tracks:[tracks[0]]};
  assert.ok(validCloud({...blankCloud(),mixes:[good]}));
  assert.ok(!validCloud({...blankCloud(),mixes:[good,good]}));
  assert.ok(!validCloud({...blankCloud(),mixes:[{...good,tracks:[{...tracks[0],email:"unexpected"}]}]}));
  assert.ok(!validCloud({...blankCloud(),mixes:Array.from({length:31},(_,i)=>({...good,id:String(i)}))}));
});
