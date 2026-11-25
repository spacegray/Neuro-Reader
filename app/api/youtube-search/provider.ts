import {defaults,playlist,type Track} from "../../musicLibrary.ts";
import {safeContent} from "../../moderation/policy.ts";
import {youtubeTerms,type SearchFilters,type YouTubeMatches} from "../../musicSearch.ts";

import {digest,quotaDay,reserveCall} from "../../security/limits.ts";
import type {ModDB} from "../../moderation/guard.ts";

const channels=[
  {id:"UCrpFW99zAUaJT8cKmqeagkg",artist:"Jason Lewis · Mind Amend",genre:"Electronic"},
  {id:"UC1bjWVLp2aaJmPcNbi9OOsw",artist:"Greenred Productions",genre:"Ambient"},
  {id:"UCSJ4gkVC6NrvII8umztf0Ow",artist:"Lofi Girl",genre:"Hip-hop"},
];
function plain(value:string){
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,code:string)=>{
    if(code.startsWith("#")){
      const n=code[1].toLowerCase()==="x"?parseInt(code.slice(2),16):Number(code.slice(1));
      return n>0 && n<=0x10ffff?String.fromCodePoint(n):"";
    }
    return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[code.toLowerCase()]||"";
  }).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
const genrePatterns:[string,RegExp][]=[
  ["Deep house",/deep house/i],["Organic house",/organic house/i],["House",/house/i],
  ["Drum and bass",/drum (?:and|n|&) bass/i],["Hip-hop",/hip[ -]?hop|lo[ -]?fi/i],
  ["Techno",/techno/i],["Jazz",/jazz/i],["Ambient",/ambient|soundscape|solfeggio/i],
];
function track(id:string,title:string,artist:string,description:string,genreHint="Music"):Track|null{
  title=plain(title).slice(0,180);artist=plain(artist).slice(0,100);
  if(!/^[\w-]{11}$/.test(id) || !title || !artist || !safeContent(title+" "+artist))return null;
  const info=plain(description).slice(0,500);
  const sound=title+" "+info;
  const genre=genrePatterns.find(([,re])=>re.test(sound))?.[0] || genreHint;
  const ethereal=/solfeggio|pure (?:sine|tone)|wordless choir|angelic (?:choir|voices)/i.test(sound) && /pure (?:sine|tone)|a cappella|no (?:drums|percussion)|without (?:drums|percussion)/i.test(sound);
  const mood=ethereal?"Ethereal":/calm|relax|chill|ambient|quiet|gentle|lo[ -]?fi/i.test(sound)?"Relaxing":/upbeat|driving|energ|danc/i.test(sound)?"Energizing":"";
  const format=/binaural/i.test(sound)?"Binaural beats":/isochronic/i.test(sound)?"Isochronic tones":/solfeggio/i.test(sound)?"Solfeggio tone":"YouTube video";
  const tags=(safeContent(info)?info:"").slice(0,350);
  return {id,title,artist,genre,mood,format,tags,activities:/read|chill|ambient|lo[ -]?fi/i.test(sound)?["Study","Reading","Work"]:["Study","Work"]};
}
export function parseFeed(xml:string,artist:string,genre:string){
  const result:Track[]=[];
  if(!/<feed\b/.test(xml))throw new Error("Missing feed");
  for(const entry of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)){
    const get=(tag:string)=>entry[1].match(new RegExp("<"+tag+">([\\s\\S]*?)</"+tag+">"))?.[1] || "";
    const item=track(get("yt:videoId"),get("title"),artist,get("media:description"),genre);
    if(item)result.push(item);
  }
  return result;
}
type ApiItem={id?:{videoId?:string};snippet?:{title?:string;channelTitle?:string;description?:string}};
async function apiSearch(key:string,q:string,signal:AbortSignal){
  const url=new URL("https://www.googleapis.com/youtube/v3/search");
  url.search=new URLSearchParams({part:"snippet",q,type:"video",order:"relevance",safeSearch:"strict",videoEmbeddable:"true",videoSyndicated:"true",maxResults:"15"}).toString();
  const response=await fetch(url,{headers:{"X-Goog-Api-Key":key},redirect:"error",signal});
  if(!response.ok)throw new Error("YouTube search unavailable");
  const data=await response.json() as {items?:ApiItem[]};
  if(!Array.isArray(data.items))throw new Error("Missing videos");
  return data.items.flatMap(x=>{
    const s=x?.snippet;
    const t=s && typeof x.id?.videoId==="string" && typeof s.title==="string" && typeof s.channelTitle==="string" &&
      track(x.id.videoId,s.title,s.channelTitle,typeof s.description==="string"?s.description:"");
    return t?[t]:[];
  });
}
type Cached<T>={value:T;expires:number};
const feedCache=new Map<string,Cached<Track[]>>();
const searchCache=new Map<string,Cached<YouTubeMatches>>();
async function uploads(channel:typeof channels[number],signal:AbortSignal){
  const hit=feedCache.get(channel.id);
  if(hit && hit.expires>Date.now())return hit.value;
  const url="https://www.youtube.com/feeds/videos.xml?channel_id="+channel.id;
  const r=await fetch(url,{signal});
  if(!r.ok)throw new Error("Uploads unavailable");
  const xml=await r.text();
  const value=parseFeed(xml,channel.artist,channel.genre);
  if(value.length)feedCache.set(channel.id,{value,expires:Date.now()+1800000});
  return value;
}
async function channelMatches(spec:SearchFilters,requestSignal:AbortSignal):Promise<YouTubeMatches>{
  const cacheKey=JSON.stringify(spec);
  const hit=searchCache.get(cacheKey);
  if(hit && hit.expires>Date.now())return hit.value;
  const signal=AbortSignal.any([requestSignal,AbortSignal.timeout(4500)]);
  const feeds=await Promise.allSettled(channels.map(channel=>uploads(channel,signal)));
  requestSignal.throwIfAborted();
  const available=feeds.filter(feed=>feed.status==="fulfilled");
  if(!available.length)return {source:"unavailable",tracks:[]};
  const candidates=[...new Map(available.flatMap(f=>f.value).map(t=>[t.id,t])).values()];
  const value:YouTubeMatches={source:"channels",tracks:playlist({...defaults,...spec},candidates).slice(0,30)};
  if(searchCache.size>=160)searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(cacheKey,{value,expires:Date.now()+600000});
  return value;
}

type Access={key?:string;subject?:string;db?:ModDB};
export async function youtubeMatches(spec:SearchFilters,access:Access,signal:AbortSignal):Promise<YouTubeMatches>{
  const {key,subject,db}=access;
  if(!subject || !key || !db){
    const curated=await channelMatches(spec,signal);
    return {...curated,reason:!subject?"sign-in":"provider-unavailable"};
  }
  const q=youtubeTerms(spec),now=Date.now();
  const lookup=await digest(q.toLowerCase().replace(/\s+/g," ").trim());
  let reason:YouTubeMatches["reason"]="provider-unavailable";
  try{
    const hit=await db.prepare("SELECT result FROM provider_calls WHERE provider='youtube' AND lookup=? AND created>? AND result IS NOT NULL ORDER BY created DESC LIMIT 1")
      .bind(lookup,now-600000).first<{result:string}>();
    if(hit)return {source:"youtube",tracks:JSON.parse(hit.result)};
    const actor=await digest(quotaDay(now)+"|"+subject);
    const id=await reserveCall(db,"youtube",actor,lookup,now);
    if(id){
      const tracks=await apiSearch(key,q,AbortSignal.any([signal,AbortSignal.timeout(5500)]));
      try{await db.prepare("UPDATE provider_calls SET result=? WHERE id=?").bind(JSON.stringify(tracks),id).run();}catch{/* The provider call was already counted. */}
      return {source:"youtube",tracks};
    }
    reason="daily-limit";
  }catch{signal.throwIfAborted();}
  return {...await channelMatches(spec,signal),reason};
}
