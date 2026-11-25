export type Track = {
  id:string; title:string; artist:string; genre:string; mood:string; activities:string[]; format:string; tags:string;
};

const mind = "Jason Lewis · Mind Amend";
const green = "Greenred Productions";
const iso = "Isochronic tones";
const binaural = "Binaural beats";
const study = ["Study","Reading"];
const work = ["Work","Study"];
export const tracks:Track[] = [
  {id:"CNYmq01WlD0",title:"Signal Path",artist:mind,genre:"Deep house",mood:"Relaxing",activities:work,format:iso,tags:"chill lock into the zone"},
  {id:"jPhxrXv78xc",title:"Tunnel Bloom",artist:mind,genre:"Electronic",mood:"Relaxing",activities:study,format:iso,tags:"chill"},
  {id:"HA6nSQawROM",title:"14 Hz Binaural Beats",artist:green,genre:"Ambient",mood:"Relaxing",activities:study,format:binaural,tags:"beta headphones"},
  {id:"gWdV17aBFeM",title:"Amber Echoes",artist:mind,genre:"Hip-hop",mood:"Energizing",activities:work,format:iso,tags:"ADHD 90s"},
  {id:"D4TtDdHLb6o",title:"Ocean Air",artist:mind,genre:"Organic house",mood:"Relaxing",activities:["Work","Reading"],format:iso,tags:"chill"},
  {id:"H1qQ5EAUt6s",title:"Music for Concentration and Focus",artist:green,genre:"Ambient",mood:"Relaxing",activities:work,format:binaural,tags:"beta headphones"},
  {id:"0D2WnhG-KmA",title:"Think Clearer & Faster",artist:mind,genre:"Deep house",mood:"Energizing",activities:work,format:iso,tags:"ADHD"},
  {id:"iIAREQRqej0",title:"Chill Electronic / Hip-Hop",artist:mind,genre:"Hip-hop",mood:"Relaxing",activities:study,format:iso,tags:"chill electronic"},
  {id:"QM1VLD16tDU",title:"ADHD High Focus Support",artist:mind,genre:"Organic house",mood:"Energizing",activities:work,format:iso,tags:"ADHD"},
  {id:"1Rc7k4RQ7hs",title:"Binaural Beats for Study",artist:green,genre:"Ambient",mood:"Relaxing",activities:study,format:binaural,tags:"headphones"},
  {id:"a4tNJTZHzPg",title:"House Turtle Mix",artist:mind,genre:"House",mood:"Energizing",activities:work,format:iso,tags:"complex tasks"},
  {id:"u2RvqKCn7S4",title:"Memory Music",artist:green,genre:"Ambient",mood:"Relaxing",activities:["Work","Reading"],format:binaural,tags:"headphones"},
  {id:"TqIrNRR3AUk",title:"Eternal Light",artist:"Artam",genre:"Ambient",mood:"Ethereal",activities:study,format:"Wordless choir",tags:"angelic voices a cappella no drums"},
  {id:"fDM6DMCWKGw",title:"528 Hz · Clear Tone",artist:"Lumen Sound",genre:"Ambient",mood:"Ethereal",activities:study,format:"Solfeggio tone",tags:"calm pure sine no drums"},
  {id:"fk3RCRbsLEg",title:"963 Hz · Pure Sine",artist:"Sunrise On Saturn",genre:"Ambient",mood:"Ethereal",activities:study,format:"Solfeggio tone",tags:"calm pure sine no drums"},
];

export const filters = {
  mood:["Relaxing","Energizing","Calm","Ethereal","Focus"],
  genre:["Ambient","Deep house","Drum and bass","Electronic","Hip-hop","House","Jazz","Organic house","Techno"],
  activity:["Study","Work","Reading","Sprint mode"],
};
export type Preferences = {mood:string;genre:string;activity:string;query:string;trackId:string};
export const defaults:Preferences = {mood:"",genre:"",activity:"",query:"",trackId:tracks[0].id};
export function restore(raw:string|null,catalog:Track[]=tracks): Preferences {
  try {
    const data=JSON.parse(raw || "{}");
    const valid=(key:keyof typeof filters)=>filters[key].includes(data[key]) ? data[key] : "";
    return {mood:valid("mood"),genre:valid("genre"),activity:valid("activity"),
      query:typeof data.query==="string"?data.query.slice(0,100):"",
      trackId:catalog.some(t=>t.id===data.trackId)?data.trackId:defaults.trackId};
  } catch {return defaults;}
}
const normalize=(text:string)=>text.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/hip[ -]?hop/g,"hiphop").replace(/mind[ -]?amend/g,"mind amend")
  .replace(/studying/g,"study").replace(/working/g,"work").replace(/drum (?:n|&) bass/g,"drum and bass")
  .replace(/solfegios?\b/g,"solfeggio").replace(/[^a-z0-9]+/g," ").trim();
export function playlist(p:Preferences,catalog:Track[]=tracks) {
  const words=normalize(p.query).split(/[^a-z0-9]+/).filter(word=>word && !["for","the","and","me","some","with","play","a","my"].includes(word));
  return catalog.filter(t=>{
    const dance=t.artist===mind && /house|electronic|techno/i.test(t.genre);
    const calm=t.mood==="Ethereal" || (t.mood==="Relaxing" && t.genre==="Ambient");
    const sprint=dance && (t.mood==="Energizing" || /progressive|driving|upbeat/i.test(t.title));
    const description=normalize([t.title,t.artist,t.genre,t.mood,t.format,t.tags,...t.activities,
      "focus music",calm?"calm":"",sprint?"sprint mode":""].join(" "));
    const moodMatches=!p.mood || t.mood===p.mood ||
      (p.mood==="Focus" && dance) ||
      (p.mood==="Calm" && calm);
    const activityMatches=!p.activity || t.activities.includes(p.activity) ||
      (p.activity==="Sprint mode" && sprint);
    return moodMatches && (!p.genre || t.genre===p.genre) && activityMatches && words.every(w=>description.includes(w));
  });
}
export function adjacent(queue:Track[],id:string,direction:number) {
  const index=queue.findIndex(t=>t.id===id);
  if(!queue.length) return undefined;
  if(index<0) return direction>0 ? queue[0] : queue[queue.length-1];
  return queue[(index+direction+queue.length)%queue.length];
}

const genrePatterns: [string,RegExp][] = [
  ["Deep house",/deep house/i],["Organic house",/organic house/i],["House",/house/i],["Drum and bass",/drum (?:and|n|&) bass/i],
  ["Techno",/techno/i],["Jazz",/jazz/i],["Hip-hop",/hip[ -]?hop|boom bap/i],["Ambient",/ambient|soundscape/i],
];
export function channelTracks(xml:string):Track[] {
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  const fresh:Track[]=[];
  for(const entry of doc.getElementsByTagNameNS("*","entry")){
    const value=(tag:string)=>entry.getElementsByTagNameNS("*",tag)[0]?.textContent?.trim() || "";
    const title=value("title");
    const id=value("videoId");
    if(!/^[a-zA-Z0-9_-]{11}$/.test(id) || !/focus|work|attention|relax|study|energ|concentration|reading/i.test(title)) continue;
    const info=title+" "+value("description").slice(0,450);
    const genre=genrePatterns.find(([,pattern])=>pattern.test(info))?.[0] || "Electronic";
    const relaxing=/calm|relax|chill|ambient|mellow|slow-paced/i.test(info);
    fresh.push({id,title,artist:mind,genre,mood:relaxing?"Relaxing":"Energizing",
      activities:/read|calm|ambient/i.test(info)?["Study","Reading","Work"]:["Study","Work"],
      format:/isochronic/i.test(info)?iso:/binaural/i.test(info)?binaural:"Focus mix",tags:/adhd/i.test(info)?"ADHD":""});
  }
  return fresh;
}
export function cachedTracks(raw:string|null,limit=24):Track[] {
  try {
    const values=JSON.parse(raw||"[]");
    return Array.isArray(values) ? values.slice(0,limit).filter(t=>t && /^[a-zA-Z0-9_-]{11}$/.test(t.id) &&
      ["title","genre","artist","format","tags","mood"].every(key=>typeof t[key]==="string") &&
      Array.isArray(t.activities) && t.activities.every((v:unknown)=>typeof v==="string")) : [];
  } catch {return [];}
}
export function mergeTracks(extra:Track[]) {
  const merged=new Map(tracks.map(t=>[t.id,t]));
  for(const t of extra){
    const known=merged.get(t.id);
    if(!known)merged.set(t.id,t);
    else if(known.title!==t.title && !known.tags.includes(t.title)){
      merged.set(t.id,{...known,tags:(known.tags+" "+t.title).trim().slice(0,512)});
    }
  }
  return [...merged.values()];
}
