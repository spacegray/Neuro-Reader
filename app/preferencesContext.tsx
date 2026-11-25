import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {applyPreference,initialReaderProfile,learningPeriod,validAction,type PreferenceAction,type ReaderProfile} from "./readerPreferenceModel";
import {stored,persist} from "./localState";

const key="neurotype-reader-preferences:guest";
function guestProfile(){
  const blank=initialReaderProfile(Date.now());
  try{
    const saved=JSON.parse(stored(key)||"null");
    if(saved && Number.isFinite(saved.firstSeen) && saved.genres && saved.choices && saved.palettes &&
      validAction({type:"colors",value:saved.colors}))return saved as ReaderProfile;
  }catch{/* Reconstruct from legacy reader settings below. */}
  const legacy=(k:string,fallback:string)=>stored("neurotype-"+k) || fallback;
  const updates:unknown[]=[
    {type:"colors",value:{palette:legacy("profile","original"),fill:legacy("fill","full"),ink:legacy("ink",blank.colors.ink),mode:legacy("display-mode","auto")}},
    {type:"strength",value:Number(legacy("strength","45"))},{type:"size",value:Number(legacy("size","21"))},
    {type:"sample",category:legacy("sample-category",""),topic:legacy("sample-topic","")}
  ];
  return updates.filter(validAction).reduce((p,a)=>applyPreference(p,a,Date.now()),blank);
}
type Pending={scope:string;id:string;actions:PreferenceAction[]};
type PrefContext={profile:ReaderProfile;ready:boolean;notice:string;apply:(a:PreferenceAction)=>void;retry:()=>void};
const context=createContext<PrefContext|null>(null);
export function useReaderPreferences(){
  const c=useContext(context);
  if(!c)throw Error("Reader preferences require a provider.");
  return c;
}
export function PreferencesProvider({children}:{children:ReactNode}){
  const [profile,setProfile]=useState(()=>initialReaderProfile(0));
  const [ready,setReady]=useState(false),[notice,setNotice]=useState("");
  const [identityChange,setIdentityChange]=useState(0);
  const writeVersion=useRef(0);
  const scope=useRef<string|null>(null),base=useRef(profile),queue=useRef<PreferenceAction[]>([]);
  const active=useRef<Pending|null>(null),busy=useRef(false),live=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const retryRef=useRef<()=>void>(()=>{});
  function render(){
    if(!live.current)return;
    const actions=[...(active.current?.actions || []),...queue.current];
    setProfile(actions.reduce((p,a)=>applyPreference(p,a,Date.now()),base.current));
  }
  async function save(){
    if(!scope.current || busy.current || !live.current)return;
    let batch=active.current;
    if(!batch){
      if(!queue.current.length)return;
      batch={id:crypto.randomUUID(),scope:scope.current,actions:queue.current.splice(0,48)};
      active.current=batch;
    }
    busy.current=true;
    try{
      const r=await fetch("/api/reader-preferences",{method:"POST",headers:{"Content-Type":"application/json","x-reader-account":batch.scope},
        keepalive:true,body:JSON.stringify({id:batch.id,actions:batch.actions}),signal:AbortSignal.timeout(7000)});
      if(!r.ok)throw Error();
      const data=await r.json() as {scope:string;profile:ReaderProfile};
      if(!live.current || batch.scope!==scope.current || data.scope!==scope.current)return;
      base.current=data.profile;writeVersion.current++;active.current=null;render();setNotice("");
      if(queue.current.length)timer.current=setTimeout(()=>void save(),20);
    }catch{
      if(live.current)setNotice("Account preferences could not sync. Your current choices still apply here.");
    }finally{
      busy.current=false;
      if(live.current && batch.scope!==scope.current && queue.current.length)void save();
    }
  }
  function apply(a:PreferenceAction){
    if(!validAction(a))return;
    if(scope.current && (a.type==="observeGenre" || a.type==="observePalette") &&
      Date.now()>=base.current.firstSeen+learningPeriod)return;
    if(scope.current==="guest"){
      base.current=applyPreference(base.current,a,Date.now());render();
      if(!persist(key,JSON.stringify(base.current)))setNotice("These preferences apply for this visit. Device storage is unavailable.");
      return;
    }
    // Only the final slider value is needed within one save interval.
    if(a.type==="strength")queue.current=queue.current.filter(old=>old.type!=="strength");
    queue.current.push(a);render();
    clearTimeout(timer.current);
    if(a.type==="strength" || a.type==="observeGenre" || a.type==="observePalette")timer.current=setTimeout(()=>void save(),240);
    else void save();
  }
  useEffect(()=>{
    live.current=true;
    const ctl=new AbortController();
    let latestLookup=0;
    async function hydrate(){
      const lookup=++latestLookup,version=writeVersion.current;
      try {
        const r=await fetch("/api/reader-preferences",{cache:"no-store",signal:AbortSignal.any([ctl.signal,AbortSignal.timeout(7000)])});
        if(!r.ok)throw Error();
        const data=await r.json() as {scope:string|null;profile?:ReaderProfile};
        if(!live.current || ctl.signal.aborted || lookup!==latestLookup)return;
        const nextScope=data.scope || "guest";
        const changed=scope.current!==null && scope.current!==nextScope;
        if(changed){
          active.current=null;queue.current=[];clearTimeout(timer.current);
          setIdentityChange(n=>n+1);
        }
        scope.current=nextScope;
        if(data.scope && data.profile){
          // An older GET can finish after a save on a restored browser tab.
          if(changed || (version===writeVersion.current && !active.current))base.current=data.profile;
          render();void save();
        }
        else {
          base.current=queue.current.reduce((p,a)=>applyPreference(p,a,Date.now()),guestProfile());queue.current=[];
          persist(key,JSON.stringify(base.current));render();
        }
        setReady(true);setNotice("");
      }catch{
        if(!ctl.signal.aborted && lookup===latestLookup && !scope.current){
          setNotice("Account preferences could not load. Your choices apply to this visit.");setReady(true);
        }
      }
    }
    const retry=()=>{if(!scope.current)void hydrate();else void save();};
    const syncGuest=(e:StorageEvent)=>{if(scope.current==="guest" && (e.key===null || e.key===key)){base.current=guestProfile();render();}};
    const visible=()=>{if(document.visibilityState==="visible")void hydrate();};
    document.addEventListener("visibilitychange",visible);
    retryRef.current=retry;void hydrate();
    window.addEventListener("pagehide",save);window.addEventListener("online",retry);window.addEventListener("storage",syncGuest);
    return ()=>{document.removeEventListener("visibilitychange",visible);live.current=false;ctl.abort();clearTimeout(timer.current);window.removeEventListener("pagehide",save);window.removeEventListener("online",retry);window.removeEventListener("storage",syncGuest);};
  },[]);
  return <context.Provider key={identityChange} value={{profile,ready,notice,apply,retry:()=>retryRef.current()}}>{children}</context.Provider>;
}
