import {cachedTracks,type Track} from "./musicLibrary.ts";

export const libraryKey="neurotype-music-library-v1";
export const historyWindow=12*60*60*1000;
export const playlistLimit=30;
export type Mix={id:string;name:string;tracks:Track[]};
export type MusicLibrary={mixes:Mix[];favorites:Track[];played:string[];started:number};
export function emptyLibrary():MusicLibrary {return {mixes:[],favorites:[],played:[],started:0};}

export function readLibrary(raw:string|null,now=Date.now()):MusicLibrary {
  try {
    const data=JSON.parse(raw || "{}");
    const readTracks=(value:unknown)=>cachedTracks(JSON.stringify(value),Infinity);
    const mixes:Mix[]=Array.isArray(data.mixes)?data.mixes.slice(0,playlistLimit)
      .filter((m:Mix)=>m && typeof m.id==="string" && typeof m.name==="string" && m.name.trim())
      .map((m:Mix)=>({id:m.id,name:m.name.slice(0,60),tracks:readTracks(m.tracks)})):[];
    const fresh=Number.isFinite(data.started) && data.started>0 && now>=data.started && now-data.started<historyWindow;
    return {mixes,favorites:readTracks(data.favorites),started:fresh?data.started:0,
      played:fresh && Array.isArray(data.played)?data.played.filter((id:unknown)=>typeof id==="string" && /^[\w-]{11}$/.test(id)):[]};
  } catch {return emptyLibrary();}
}
export function markPlayed(lib:MusicLibrary,id:string,now=Date.now()):MusicLibrary {
  const fresh=lib.started>0 && now-lib.started<historyWindow;
  if(fresh && lib.played.includes(id))return lib;
  return {...lib,started:fresh?lib.started:now,played:fresh?[...lib.played,id]:[id]};
}
export function recommendations(pool:Track[],members:Track[],current:Track) {
  const seeds=members.length?members.slice(-8):[current];
  const existing=new Set(members.map(t=>t.id));
  function score(t:Track) {
    return seeds.reduce((sum,s)=>sum+Number(s.genre===t.genre)*4+Number(s.mood===t.mood)*3+
      Number(s.format===t.format)*2+Number(t.activities.some(a=>s.activities.includes(a))),0);
  }
  return pool.filter(t=>!existing.has(t.id)).map(track=>({track,rank:score(track)}))
    .sort((a,b)=>b.rank-a.rank).map(item=>item.track);
}
