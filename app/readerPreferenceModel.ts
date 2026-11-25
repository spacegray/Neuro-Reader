import {profiles,inkModes,type InkMode} from "./readerChoices.ts";
import {filters,type Track} from "./musicLibrary.ts";
import {sampleCategories,sampleShelf} from "./readingSamples.ts";

export type Colors={palette:string;fill:"full"|"soft";ink:InkMode;mode:"auto"|"light"|"dark"};
export type GenreChoice="auto"|"prefer"|"avoid";
export const learningPeriod=24*60*60*1000;
export type ReaderProfile={
  firstSeen:number;colors:Colors;strength:number;size:number;category:string;topic:string;
  palettes:Record<string,number>;genres:Record<string,number>;choices:Record<string,GenreChoice>;
};
export type PreferenceAction=
  |{type:"colors";value:Colors}
  |{type:"observePalette"|"observeGenre";value:string}
  |{type:"strength"|"size";value:number}
  |{type:"sample";category:string;topic:string}
  |{type:"genre";genre:string;choice:GenreChoice};
export function initialReaderProfile(now:number):ReaderProfile{
  return {firstSeen:now,colors:{palette:"original",fill:"full",ink:"Bright",mode:"auto"},strength:45,size:21,
    category:"",topic:"",palettes:{},genres:{},choices:{}};
}
export function validAction(input:unknown):input is PreferenceAction{
  if(!input || typeof input!=="object")return false;
  const a=input as PreferenceAction;
  switch(a.type){
    case "colors":return !!a.value && profiles.some(p=>p.id===a.value.palette) && ["full","soft"].includes(a.value.fill) &&
      inkModes.includes(a.value.ink) && ["auto","light","dark"].includes(a.value.mode);
    case "observePalette":return profiles.some(p=>p.id===a.value);
    case "observeGenre":return filters.genre.includes(a.value);
    case "strength":return Number.isInteger(a.value) && a.value>=25 && a.value<=75 && a.value%5===0;
    case "size":return [18,21,25].includes(a.value);
    case "sample":return (a.category==="" || sampleCategories.includes(a.category)) &&
      (a.topic==="" || sampleShelf.some(s=>s.category===a.category && s.topic===a.topic));
    case "genre":return filters.genre.includes(a.genre) && ["auto","prefer","avoid"].includes(a.choice);
    default:return false;
  }
}
export function applyPreference(p:ReaderProfile,a:PreferenceAction,now:number):ReaderProfile{
  if(!validAction(a))return p;
  switch(a.type){
    case "colors":return {...p,colors:{palette:a.value.palette,ink:a.value.ink,fill:a.value.fill,mode:a.value.mode}};
    case "strength":return {...p,strength:a.value};
    case "size":return {...p,size:a.value};
    case "sample":return {...p,category:a.category,topic:a.topic};
    case "genre":return {...p,choices:{...p.choices,[a.genre]:a.choice}};
    default:{
      if(now>=p.firstSeen+learningPeriod || now<p.firstSeen)return p;
      const key=a.type==="observeGenre"?"genres":"palettes";
      return {...p,[key]:{...p[key],[a.value]:Math.min(65535,(p[key][a.value] || 0)+1)}};
    }
  }
}
export function topColors(profile:ReaderProfile){
  return profiles.filter(p=>(profile.palettes[p.id] || 0)>0).sort((a,b)=>profile.palettes[b.id]-profile.palettes[a.id]).slice(0,3);
}
export function personalizeMusic(pool:Track[],profile:ReaderProfile){
  const weight=(genre:string)=>(profile.choices[genre]==="prefer"?100000:0)+(profile.genres[genre] || 0);
  return pool.filter(t=>profile.choices[t.genre]!=="avoid").sort((a,b)=>weight(b.genre)-weight(a.genre));
}
