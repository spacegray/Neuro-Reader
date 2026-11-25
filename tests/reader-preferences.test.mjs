import assert from "node:assert/strict";
import test from "node:test";
import {applyPreference,initialReaderProfile,learningPeriod,personalizeMusic,topColors,validAction} from "../app/readerPreferenceModel.ts";
import {tracks} from "../app/musicLibrary.ts";

test("previews rank up to three palettes in the first 24 hours and preserve the saved default",()=>{
  const start=12345;
  let p=initialReaderProfile(start);
  for(const value of ["paper","blue","lilac","lilac","rose","rose","rose"])p=applyPreference(p,{type:"observePalette",value},start+learningPeriod-1);
  assert.deepEqual(topColors(p).map(c=>c.id),["rose","lilac","paper"]);
  assert.equal(p.colors.palette,"original");
  assert.equal(applyPreference(p,{type:"observePalette",value:"blue"},start+learningPeriod),p);
  const colors={palette:"butter",fill:"soft",ink:"Two-tone",mode:"dark"};
  assert.deepEqual(applyPreference(p,{type:"colors",value:colors},start+2*learningPeriod).colors,colors);
});

test("music preferences rank the queue, exclude disliked genres and allow reversing a dislike",()=>{
  let p=initialReaderProfile(0);
  p=applyPreference(p,{type:"observeGenre",value:"Ambient"},1);
  p=applyPreference(p,{type:"genre",genre:"Hip-hop",choice:"prefer"},learningPeriod);
  p=applyPreference(p,{type:"genre",genre:"Deep house",choice:"avoid"},learningPeriod);
  const queue=personalizeMusic(tracks,p);
  assert.equal(queue[0].genre,"Hip-hop");
  assert.equal(queue.find(t=>t.genre!=="Hip-hop").genre,"Ambient");
  assert.ok(queue.every(t=>t.genre!=="Deep house"));
  assert.equal(applyPreference(p,{type:"observeGenre",value:"Ambient"},learningPeriod),p);
  p=applyPreference(p,{type:"genre",genre:"Deep house",choice:"auto"},learningPeriod);
  assert.ok(personalizeMusic(tracks,p).some(t=>t.genre==="Deep house"));
});

test("reader controls use existing supported sizes, strengths and category/topic pairs",()=>{
  let p=initialReaderProfile(0);
  for(const action of [{type:"size",value:25},{type:"strength",value:70},{type:"sample",category:"Stories",topic:"Adventures"}])
    p=applyPreference(p,action,learningPeriod);
  assert.deepEqual([p.size,p.strength,p.category,p.topic],[25,70,"Stories","Adventures"]);
  for(const action of [{type:"sample",category:"Poetry",topic:"Adventures"},{type:"strength",value:32},{type:"size",value:99},{type:"observeGenre",value:"__proto__"},{type:"colors",value:{palette:"invalid"}}]){
    assert.equal(validAction(action),false);assert.equal(applyPreference(p,action,0),p);
  }
});

test("new readers start with Bright ink and existing word color choices remain valid",()=>{
  const profile=initialReaderProfile(0);
  assert.equal(profile.colors.ink,"Bright");
  for(const ink of ["Neutral","Palette","Two-tone","Bright"]){
    const action={type:"colors",value:{...profile.colors,ink}};
    assert.ok(validAction(action));
    assert.equal(applyPreference(profile,action,0).colors.ink,ink);
  }
});
