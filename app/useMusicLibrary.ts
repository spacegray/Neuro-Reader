import {useEffect,useRef,useState} from "react";
import {clearDeletedReaderData} from "./accountServices/localCleanup";
import {persist,stored} from "./localState";
import {emptyLibrary,historyWindow,libraryKey,readLibrary,type MusicLibrary} from "./listeningLibrary";
import {defaults,type Preferences} from "./musicLibrary";
import {blankCloud,cloudOf,emptyRemote,readPrefs,rebaseMusic,validCloud,type CloudMusic,type RemoteMusic} from "./musicProfile";

const guest="guest", guestPrefs="neurotype-listener-v1";
type Snapshot={library:MusicLibrary;profile:Preferences;base:RemoteMusic};
const fresh=():Snapshot=>({library:emptyLibrary(),profile:{...defaults},base:emptyRemote()});
const cacheKey=(scope:string)=>"neurotype-music-v2:"+scope;
function guestData():Snapshot{
  return {library:readLibrary(stored(libraryKey)),profile:readPrefs(stored(guestPrefs)),base:emptyRemote()};
}
function decode(scope:string,raw:string|null):Snapshot{
  if(!raw)return scope===guest?guestData():fresh();
  try{
    const data=JSON.parse(raw);
    return {library:readLibrary(JSON.stringify(data.library)),profile:readPrefs(JSON.stringify(data.profile)),
      base:validRemote(data.base)?data.base:emptyRemote()};
  }catch{return fresh();}
}
function validRemote(v:RemoteMusic):boolean{
  return Boolean(v && Number.isSafeInteger(v.revision) && v.revision>=0 && validCloud(v.profile));
}
function withCloud(state:Snapshot,cloud:CloudMusic,base:RemoteMusic):Snapshot{
  return {library:{...state.library,mixes:cloud.mixes,favorites:cloud.favorites},profile:{...state.profile,...cloud.filters},base};
}
function somethingToImport(src:MusicLibrary,dest:MusicLibrary){
  const ids=new Set(dest.favorites.map(t=>t.id));
  if(src.favorites.some(t=>!ids.has(t.id)))return true;
  return src.mixes.some(m=>{
    const target=dest.mixes.find(v=>m.id===v.id);
    return target?m.tracks.some(t=>!target.tracks.some(t2=>t2.id===t.id)):dest.mixes.length<30;
  });
}

// All writes are scoped to a verified account. The last acknowledged cloud revision is kept
// alongside local edits, so a disconnected tab can safely replay those edits after reconnect.
class MusicStore {
  state=fresh();
  scope="";
  ready=false;
  saved=true;
  message="";
  private cacheRaw:string|null=null;
  private busy=false;
  private pending=false;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private fetchNumber=0;
  private aborted=new AbortController();
  constructor(private emit:()=>void){}
  private readLatest(){
    if(!this.scope)return;
    const raw=stored(cacheKey(this.scope));
    if(raw!==this.cacheRaw){this.state=decode(this.scope,raw);this.cacheRaw=raw;}
    if(this.state.library.started && Date.now()-this.state.library.started>=historyWindow){
      this.state={...this.state,library:{...this.state.library,started:0,played:[]}};
    }
  }
  private write(next:Snapshot){
    this.state=next;
    const raw=JSON.stringify(next);
    this.saved=persist(cacheKey(this.scope),raw);
    if(this.saved)this.cacheRaw=raw;
    this.emit();
  }
  private open(scope:string){
    if(this.scope===scope)return;
    this.scope=scope;this.cacheRaw=stored(cacheKey(scope));
    this.state=decode(scope,this.cacheRaw);this.ready=false;this.message="";this.emit();
  }
  private async handleClosure(response:Response){
    if(response.status!==410)return false;
    const receipt=await response.json() as {code?:string;owner?:string};
    if(receipt.code!=="profile_deleted" || typeof receipt.owner!=="string")return false;
    clearDeletedReaderData(receipt.owner);
    this.dispose();
    window.location.replace("/account-deleted");
    return true;
  }
  async identify(){
    const seq=++this.fetchNumber;
    try{
      const result=await fetch("/api/account",{cache:"no-store",signal:AbortSignal.any([this.aborted.signal,AbortSignal.timeout(8000)])});
      if(this.aborted.signal.aborted || seq!==this.fetchNumber)return;
      if(await this.handleClosure(result))return;
      if(!result.ok)throw new Error();
      const {user}=await result.json() as {user:{id:string}|null};
      if(this.aborted.signal.aborted || seq!==this.fetchNumber)return;
      this.open(typeof user?.id==="string" && user.id?"user:"+user.id:guest);
      if(this.scope!==guest){await this.flush(true);return;}
    }catch{
      if(this.aborted.signal.aborted || seq!==this.fetchNumber)return;
      if(!this.scope)this.open(guest);
      this.message="Account sync is unavailable. Changes are saved on this device.";
    }
    this.ready=true;this.emit();
  }
  private sendSoon(){
    if(!this.scope || this.scope===guest)return;
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>void this.flush(false),350);
  }
  private async flush(refresh:boolean){
    if(this.aborted.signal.aborted || !this.scope || this.scope===guest)return;
    if(this.busy){this.pending=true;return;}
    this.busy=true;const scope=this.scope;
    const headers={"x-music-account":scope.slice(5),"Content-Type":"application/json"};
    try{
      let needsRead=refresh;
      for(let tries=0;tries<5;tries++){
        this.readLatest();
        const previous=this.state;
        const sent=cloudOf(previous.library,previous.profile);
        const isDirty=JSON.stringify(sent)!==JSON.stringify(previous.base.profile);
        if(!needsRead && !isDirty)break;
        const put=!needsRead && isDirty;
        const result=await fetch("/api/music-profile",{headers,cache:"no-store",signal:AbortSignal.any([this.aborted.signal,AbortSignal.timeout(8000)]),
          method:put?"PUT":"GET",...(put && {body:JSON.stringify({revision:previous.base.revision,profile:sent})})});
        if(this.aborted.signal.aborted || scope!==this.scope)return;
        if(await this.handleClosure(result))return;
        if(result.status===401){this.open(guest);this.message="Your account changed. Reload to switch music profiles.";return;}
        if(!result.ok && result.status!==409)throw new Error(result.status===413 || result.status===422?"size":"unavailable");
        const remote=await result.json() as RemoteMusic;
        if(!validRemote(remote))throw new Error("unavailable");
        if(this.aborted.signal.aborted || scope!==this.scope)return;
        this.readLatest();needsRead=false;
        if(remote.revision<this.state.base.revision)continue;
        // Edits during the request belong on top of its response. For a successful PUT
        // they are differences from what was sent; on a conflict use the acknowledged base.
        const before=put && result.ok?sent:this.state.base.profile;
        const local=cloudOf(this.state.library,this.state.profile);
        const merged=rebaseMusic(before,local,remote.profile);
        if(merged.mixes.length>30)throw new Error("limit");
        this.write(withCloud(this.state,merged,remote));
        this.message="Playlists, favorites, and listening filters are saved to your account.";
      }
    }catch(error){
      if(this.aborted.signal.aborted || scope!==this.scope)return;
      this.message=error instanceof Error && error.message==="limit"
        ?"A second device added playlists. Remove a playlist here to sync within the 30-playlist limit."
        :error instanceof Error && error.message==="size"?"This library exceeds the account sync limit. Remove tracks to sync it."
        :"Account sync is unavailable. Your changes will retry when you return.";
    }finally{
      this.busy=false;
      if(!this.aborted.signal.aborted){
        this.ready=true;this.emit();
        if(this.pending){this.pending=false;void this.flush(scope!==this.scope);}
      }
    }
  }
  private edit(next:Snapshot){
    this.write(next);
    if(this.scope!==guest){this.message="Saving to your account…";this.sendSoon();this.emit();}
  }
  change=(edit:(lib:MusicLibrary)=>MusicLibrary)=>{
    if(!this.scope)return;
    this.readLatest();const old=this.state.library,next=edit(old);
    if(old===next)return;
    if(old.mixes===next.mixes && old.favorites===next.favorites)this.write({...this.state,library:next});
    else this.edit({...this.state,library:next});
  };
  updateProfile=(values:Partial<Preferences>)=>{
    if(!this.scope)return;
    this.readLatest();const profile={...this.state.profile,...values};
    if(["mood","genre","activity"].some(k=>k in values))this.edit({...this.state,profile});
    else this.write({...this.state,profile});
  };
  get canImport(){
    if(!this.ready || !this.scope.startsWith("user:"))return false;
    const local=decode(guest,stored(cacheKey(guest)));
    return somethingToImport(local.library,this.state.library);
  }
  importDeviceLibrary=()=>{
    if(!this.canImport)return;
    this.readLatest();
    const local=decode(guest,stored(cacheKey(guest)));
    const cloud=cloudOf(this.state.library,this.state.profile);
    const imported=rebaseMusic(blankCloud(),{...cloudOf(local.library,local.profile),filters:cloud.filters},cloud);
    if(imported.mixes.length>30){
      this.message="Make room in your account before importing these playlists. You can keep up to 30.";this.emit();return;
    }
    this.edit(withCloud(this.state,imported,this.state.base));
  };
  onStorage=(event:StorageEvent)=>{
    if(event.key===cacheKey(this.scope) || event.key===null){this.readLatest();this.emit();this.sendSoon();}
  };
  onVisible=()=>{if(document.visibilityState==="visible")void this.identify();};
  expire=()=>{this.readLatest();this.emit();};
  dispose(){clearTimeout(this.timer);this.aborted.abort();}
}
export function useMusicLibrary(){
  const [,render]=useState(0);
  const ref=useRef<MusicStore|null>(null);
  useEffect(()=>{
    const store=new MusicStore(()=>render(n=>n+1));ref.current=store;
    const online=()=>void store.identify();
    window.addEventListener("online",online);window.addEventListener("storage",store.onStorage);
    document.addEventListener("visibilitychange",store.onVisible);online();
    return ()=>{store.dispose();window.removeEventListener("online",online);window.removeEventListener("storage",store.onStorage);document.removeEventListener("visibilitychange",store.onVisible);};
  },[]);
  const store=ref.current;
  const started=store?.state.library.started;
  useEffect(()=>{
    if(!started || !store)return;
    const timer=setTimeout(store.expire,Math.max(1,started+historyWindow-Date.now()+1));
    return ()=>clearTimeout(timer);
  },[store,started]);
  const {library,profile}=store?.state || fresh();
  return {library,profile,saved:store?.saved??true,scopeKey:store?.scope || "",ready:store?.ready??false,
    syncMessage:store?.message || "",canImport:store?.canImport??false,
    importDeviceLibrary:store?.importDeviceLibrary || (()=>{}),change:store?.change || (()=>{}),updateProfile:store?.updateProfile || (()=>{})};
}
