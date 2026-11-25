import {defaults,filters,type Preferences,type Track} from "./musicLibrary.ts";
import type {Mix,MusicLibrary} from "./listeningLibrary.ts";

export type ListeningFilters=Pick<Preferences,"mood"|"activity"|"genre">;
export type CloudMusic={mixes:Mix[];favorites:Track[];filters:ListeningFilters};
export type RemoteMusic={revision:number;profile:CloudMusic};
const filterKeys=["mood","genre","activity"] as const;
export const blankCloud=():CloudMusic=>({mixes:[],favorites:[],filters:{mood:"",genre:"",activity:""}});
export const emptyRemote=():RemoteMusic=>({revision:0,profile:blankCloud()});
export function listeningFilters(p:Partial<Preferences>):ListeningFilters{
  const clean=(k:keyof typeof filters)=>filters[k].includes(p[k] || "")?p[k] as string:"";
  return {mood:clean("mood"),genre:clean("genre"),activity:clean("activity")};
}
export function readPrefs(raw:string|null):Preferences{
  try{
    const value=JSON.parse(raw || "{}");
    return {...listeningFilters(value),trackId:typeof value.trackId==="string" && /^[\w-]{11}$/.test(value.trackId)?value.trackId:defaults.trackId,
      query:typeof value.query==="string"?value.query.slice(0,100):""};
  }catch{return {...defaults};}
}
export function cloudOf(lib:MusicLibrary,prefs:Preferences):CloudMusic{
  return {mixes:lib.mixes,favorites:lib.favorites,filters:listeningFilters(prefs)};
}
export function mergeTracksDelta(base:Track[],local:Track[],remote:Track[]):Track[]{
  const baseIds=new Set(base.map(t=>t.id)), localIds=new Set(local.map(t=>t.id)), remoteIds=new Set(remote.map(t=>t.id));
  return [...remote.filter(t=>!baseIds.has(t.id) || localIds.has(t.id)),...local.filter(t=>!baseIds.has(t.id) && !remoteIds.has(t.id))];
}
// Reapply only local edits. A rename and a membership change from different devices both survive.
// A locally unchanged item deleted elsewhere stays deleted.
export function rebaseMusic(base:CloudMusic,local:CloudMusic,remote:CloudMusic):CloudMusic{
  const old=new Map(base.mixes.map(m=>[m.id,m])), edited=new Map(local.mixes.map(m=>[m.id,m]));
  const remoteIds=new Set(remote.mixes.map(m=>m.id));
  const mixes=remote.mixes.filter(m=>!old.has(m.id) || edited.has(m.id)).map(m=>{
    const previous=old.get(m.id), next=edited.get(m.id);
    if(!next)return m;
    return {...m,name:previous && next.name!==previous.name?next.name:m.name,
      tracks:mergeTracksDelta(previous?.tracks || [],next.tracks,m.tracks)};
  });
  for(const m of local.mixes)if(!old.has(m.id) && !remoteIds.has(m.id))mixes.push(m);
  const f={...remote.filters};
  for(const k of filterKeys)if(local.filters[k]!==base.filters[k])f[k]=local.filters[k];
  return {mixes,favorites:mergeTracksDelta(base.favorites,local.favorites,remote.favorites),filters:f};
}

const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==="object" && !Array.isArray(v);
const str=(v:unknown,max:number):v is string=>typeof v==="string" && v.length<=max && !/[\u0000-\u001f\u007f]/.test(v);
function validTracks(list:unknown):list is Track[]{
  if(!Array.isArray(list) || list.length>600)return false;
  const ids=new Set();
  for(const t of list) {
    if(!record(t) || !str(t.id,11) || !/^[\w-]{11}$/.test(t.id) || ids.has(t.id) ||
      !["title","artist","genre","mood","format","tags"].every(k=>str(t[k],512)) ||
      !Array.isArray(t.activities) || t.activities.length>20 || !t.activities.every(x=>str(x,64)))return false;
    if(Object.keys(t).some(k=>!["id","title","artist","genre","mood","format","tags","activities"].includes(k)))return false;
    ids.add(t.id);
  }
  return true;
}
export function validCloud(value:unknown):value is CloudMusic{
  if(!record(value) || Object.keys(value).some(k=>!["mixes","favorites","filters"].includes(k)) || !validTracks(value.favorites) ||
     !Array.isArray(value.mixes) || value.mixes.length>30 || !record(value.filters))return false;
  const parts=value.filters;
  if(Object.keys(parts).some(k=>!filterKeys.includes(k as keyof ListeningFilters)) ||
     !filterKeys.every(k=>typeof parts[k]==="string" && (parts[k]==="" || filters[k].includes(parts[k] as string))))return false;
  const ids=new Set();
  for(const m of value.mixes){
    if(!record(m) || Object.keys(m).some(k=>!["id","name","tracks"].includes(k)) ||
       !str(m.id,80) || !/^[\w-]+$/.test(m.id) || ["queue","favorites","new"].includes(m.id) || ids.has(m.id) ||
       !str(m.name,60) || !m.name.trim() || !validTracks(m.tracks))return false;
    ids.add(m.id);
  }
  return true;
}
