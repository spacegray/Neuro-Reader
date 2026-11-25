import assert from "node:assert/strict";
import test from "node:test";
import {adjacent,defaults,mergeTracks,playlist,restore,tracks} from "../app/musicLibrary.ts";

test("restores the listening profile and advances inside the matching queue",()=>{
  const profile={...defaults,query:"ADHD focus",activity:"Work",mood:"Energizing",trackId:"gWdV17aBFeM"};
  assert.deepEqual(restore(JSON.stringify(profile)),profile);
  const matches=playlist(profile);
  assert.ok(matches.length>1);
  assert.equal(adjacent(matches,matches.at(-1).id,1).id,matches[0].id);
  assert.equal(adjacent(matches,matches[0].id,-1).id,matches.at(-1).id);
  assert.equal(adjacent([],profile.trackId,1),undefined);
});
test("refreshing the channel preserves distinct videos and restores a feed track",()=>{
  const extra={...tracks[0],id:"abcdefgh123",title:"New session"};
  const catalog=mergeTracks([extra,tracks[0],extra]);
  assert.equal(catalog.length,tracks.length+1);
  assert.equal(restore(JSON.stringify({trackId:extra.id}),catalog).trackId,extra.id);
  assert.deepEqual(restore("broken json"),defaults);
  assert.deepEqual(playlist({...defaults,query:"new session"},catalog),[extra]);
});

test("new moods and sprint activity build distinct playable queues",()=>{
  for(const mood of ["Focus","Calm","Ethereal"]){
    const p=restore(JSON.stringify({...defaults,mood}));
    const q=playlist(p);
    assert.equal(p.mood,mood);
    assert.ok(q.length>=2);
    if(mood==="Ethereal")assert.ok(q.every(t=>["Solfeggio tone","Wordless choir"].includes(t.format)));
    if(mood==="Focus")assert.ok(q.every(t=>t.artist.includes("Jason Lewis")));
  }
  const sprint=playlist({...defaults,activity:"Sprint mode"});
  assert.ok(sprint.length>=2 && sprint.every(t=>t.artist.includes("Jason Lewis")));
});

test("search matches source titles, artist spellings, and activity names within active filters",()=>{
  const sourceTitle={...tracks[0],title:"Lock Into The Zone | Chill Deep House"};
  const catalog=mergeTracks([sourceTitle]);
  assert.deepEqual(playlist({...defaults,genre:"Deep house",query:"lock into the zone"},catalog).map(t=>t.id),[tracks[0].id]);
  assert.ok(playlist({...defaults,query:"MindAmend"},catalog).length>1);
  for(const query of ["sprint mode","calm","chill electronic","binaural beats"])assert.ok(playlist({...defaults,query},catalog).length,query);
  assert.deepEqual(playlist({...defaults,genre:"Deep house",query:"binaural beats"},catalog),[]);
});

test("each guest collection supplies ten unique tracks and refills from its reserves",async()=>{
  const {collectionNames,collectionTracks}=await import("../app/musicCollections.ts");
  const {nextWindow}=await import("../app/queueWindow.ts");
  assert.equal(collectionNames.length,5);
  for(const name of collectionNames){
    const pool=collectionTracks(name);
    assert.equal(new Set(pool.map(t=>t.id)).size,20);
    assert.ok(pool.every(t=>/^[\w-]{11}$/.test(t.id) && t.title && t.artist));
    const initial=pool.slice(0,10);
    const next=nextWindow(pool,initial.at(-1));
    assert.deepEqual(next.map(t=>t.id),pool.slice(9,19).map(t=>t.id));
    const wrap=nextWindow(pool,next.at(-1));
    assert.equal(wrap[1].id,pool[19].id);assert.equal(new Set(wrap.map(t=>t.id)).size,10);
  }
});
