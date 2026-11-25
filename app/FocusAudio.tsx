import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {persist,stored} from "./localState";
import {adjacent,cachedTracks,channelTracks,defaults,filters,mergeTracks,playlist,tracks,type Preferences,type Track} from "./musicLibrary";
import QueueLibrary from "./QueueLibrary";
import "./playerConsole.css";
import {useMusicLibrary} from "./useMusicLibrary";
import {markPlayed} from "./listeningLibrary";
import {useReaderPreferences} from "./preferencesContext";
import {personalizeMusic} from "./readerPreferenceModel";
import {youtubeTerms,type SearchFilters,type YouTubeMatches} from "./musicSearch";
import {supportedQuery} from "./moderation/policy";
import MusicIcon from "./MusicIcon";
import {useYouTube} from "./useYouTube";

import {collectionNames as suggestions,collectionTracks} from "./musicCollections";
import {distinctTracks,nextWindow} from "./queueWindow";
const collectionCatalog=distinctTracks(suggestions.flatMap(collectionTracks));
function afterQueuePaint(){
  return new Promise<void>(resolve=>{
    // Background tabs can suspend animation frames while music keeps playing.
    const fallback=window.setTimeout(resolve,100);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(fallback);resolve();}));
  });
}
type QueuePage={key:string;items:Track[];pool:Track[]};
const filterNames=["mood","genre","activity"] as const;

export default function FocusAudio({editorOpen,closeEditor}:{editorOpen:boolean;closeEditor:()=>void}) {
  const {library,change,saved,profile,updateProfile,ready,scopeKey,syncMessage,importDeviceLibrary,canImport}=useMusicLibrary();
  const reader=useReaderPreferences();
  const [catalog,setCatalog]=useState(tracks);
  const [earlyQuery,setEarlyQuery]=useState<string|null>(null);
  const query=earlyQuery??profile.query;
  const [remote,setRemote]=useState<YouTubeMatches|null>(null);
  const [windowPage,setWindowPage]=useState<QueuePage|null>(null);
  const [queueStatus,setQueueStatus]=useState("");
  const [queueBusy,setQueueBusy]=useState(false);
  const queueGeneration=useRef(0);
  const preparing=useRef<{id:string;job:Promise<QueuePage|null>}|null>(null);
  function resetWindow(){
    queueGeneration.current++;
    preparing.current=null;
    setWindowPage(null);setQueueBusy(false);setQueueStatus("");
  }
  const [remoteBusy,setRemoteBusy]=useState(false);
  const [remoteError,setRemoteError]=useState("");
  const remoteRequest=useRef<AbortController|null>(null);
  const [lastVideo,setLastVideo]=useState<Track|null>(null);
  const remoteKey="neurotype-youtube-last-"+scopeKey;
  useEffect(()=>{
    try{
      const saved=JSON.parse(stored(remoteKey) || "null");
      setLastVideo(saved && saved.expires>Date.now()?cachedTracks(JSON.stringify([saved.track]),1)[0] || null:null);
    }catch{setLastVideo(null);}
    resetRemote();
    return ()=>remoteRequest.current?.abort();
  },[remoteKey]);
  const searchSpec={query,mood:profile.mood,genre:profile.genre,activity:profile.activity};
  const terms=youtubeTerms(searchSpec);
  const canSearch=supportedQuery(query.trim() || "focus music");
  function resetRemote(){
    resetWindow();remoteRequest.current?.abort();remoteRequest.current=null;
    setRemote(null);setRemoteError("");setRemoteBusy(false);
  }
  async function searchYouTube(spec:SearchFilters){
    resetRemote();setView("queue");setRemoteBusy(true);
    const controller=new AbortController();remoteRequest.current=controller;
    try{
      const response=await fetch("/api/youtube-search",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(spec),signal:controller.signal});
      const body=await response.json() as YouTubeMatches & {error?:string};
      if(controller.signal.aborted)return;
      if(!response.ok || !["youtube","channels","unavailable"].includes(body.source)){
        setRemoteError(body.error || "Live YouTube results are unavailable. Showing library matches.");return;
      }
      setRemote({source:body.source,reason:body.reason,tracks:cachedTracks(JSON.stringify(body.tracks),30)});
    }catch{if(!controller.signal.aborted)setRemoteError("Live YouTube results are unavailable. Showing library matches.");}
    finally{if(!controller.signal.aborted)setRemoteBusy(false);}
  }
  useEffect(()=>{
    if(scopeKey && earlyQuery!==null){updateProfile({query:earlyQuery});setEarlyQuery(null);}
  },[scopeKey,earlyQuery,updateProfile]);
  const savedCatalog=useMemo(()=>{
    const items=[...catalog,...collectionCatalog,...library.favorites,...library.mixes.flatMap(mix=>mix.tracks)];
    const ids=new Set<string>();
    return items.filter(t=>{if(ids.has(t.id))return false;ids.add(t.id);return true;});
  },[catalog,library.favorites,library.mixes]);
  const suggestedCatalog=useMemo(()=>personalizeMusic(catalog,reader.profile),[reader.profile,catalog]);
  const searchCatalog=useMemo(()=>personalizeMusic(savedCatalog,reader.profile),[savedCatalog,reader.profile]);
  const [playerSession,setPlayerSession]=useState<{scope:string;id:string}|null>(null);
  const initialId=ready && playerSession?.scope===scopeKey?playerSession.id:null;
  const currentTrackId=useRef(profile.trackId);
  useEffect(()=>{currentTrackId.current=profile.trackId;},[profile.trackId]);
  useEffect(()=>{
    if(ready)setPlayerSession(session=>session?.scope===scopeKey?session:{scope:scopeKey,id:profile.trackId});
  },[ready,scopeKey,profile.trackId]);
  const [miniOpen,setMiniOpen]=useState(false);
  const [miniHost,setMiniHost]=useState<HTMLElement|null>(null);
  const miniRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!miniOpen)return;
    let from=0, since=0, lastInput=-Infinity, target:EventTarget|null=null;
    const input=(e:Event)=>{
      const now=performance.now();
      if(now-lastInput>240){
        const modal=e.target instanceof Element?e.target.closest(".reader-modal"):null;
        target=modal || document;from=modal?modal.scrollTop:window.scrollY;since=now;
      }
      lastInput=now;
    };
    const scroll=(e:Event)=>{
      const now=performance.now();
      if(now-lastInput>350)return;
      const el=e.target;
      if(el!==document && !(el instanceof HTMLElement && (el.matches("dialog") || el.closest(".reader-modal"))))return;
      const y=el instanceof HTMLElement?el.scrollTop:window.scrollY;
      if(el!==target || now-since>300 || y<from){target=el;from=y;since=now;return;}
      if(y-from>Math.max(380,window.innerHeight*.42) && (y-from)/Math.max(16,now-since)>2.6)setMiniOpen(false);
    };
    document.addEventListener("wheel",input,{passive:true});
    document.addEventListener("touchmove",input,{passive:true});
    document.addEventListener("scroll",scroll,true);
    return ()=>{document.removeEventListener("wheel",input);document.removeEventListener("touchmove",input);document.removeEventListener("scroll",scroll,true);};
  },[miniOpen]);
  const heading=useRef<HTMLHeadingElement>(null);
  const trackList=useRef<HTMLDivElement>(null);
  const toggleButton=useRef<HTMLButtonElement>(null);

  const [viewId,setView]=useState("queue");
  useEffect(()=>{setView("queue");},[scopeKey]);
  const mix=library.mixes.find(m=>m.id===viewId);
  const view=mix?.id || (viewId==="favorites"?"favorites":"queue");
  const key=JSON.stringify([scopeKey,query,profile.mood,profile.genre,profile.activity]);
  const collection=suggestions.includes(query) && !remote && !filterNames.some(k=>profile[k]) ? query:"";
  const basePool=useMemo(()=>{
    if(collection)return collectionTracks(collection);
    if(remote?.tracks.length)return remote.tracks;
    return playlist({...profile,query},query.trim()?searchCatalog:distinctTracks([...suggestedCatalog,...collectionCatalog]));
  },[collection,remote,profile,query,searchCatalog,suggestedCatalog]);
  const firstPage=useMemo(()=>{
    if(!basePool.length || basePool.length>=10)return basePool.slice(0,10);
    const genres=new Set(basePool.map(t=>t.genre));
    const extras=collectionCatalog.filter(t=>genres.has(t.genre));
    return distinctTracks([...basePool,...extras,...collectionCatalog]).slice(0,10);
  },[basePool]);
  const activePage=windowPage?.key===key?windowPage:null;
  const queue=mix?mix.tracks:view==="favorites"?library.favorites:activePage?.items || firstPage;
  const selected=queue.find(t=>t.id===profile.trackId) || (lastVideo?.id===profile.trackId?lastVideo:null) || savedCatalog.find(t=>t.id===profile.trackId) || tracks[0];
  const morePool=()=>distinctTracks([...(activePage?.pool || distinctTracks([...basePool,...firstPage])),...(collection?[]:
    [...suggestedCatalog,...collectionCatalog].filter(t=>t.genre===selected.genre)),...(collection?[]:collectionCatalog)]);

  function prepare(anchor:Track){
    if(preparing.current?.id===anchor.id)return preparing.current.job;
    const version=queueGeneration.current;
    setQueueBusy(true);setQueueStatus("Loading more tracks…");
    const job=afterQueuePaint().then(()=>{
      if(version!==queueGeneration.current)return null;
      const pool=morePool(),page={key,pool,items:nextWindow(pool,anchor)};
      if(view==="queue")setWindowPage(page);
      setQueueBusy(false);setQueueStatus("Next tracks ready.");
      return page;
    });
    preparing.current={id:anchor.id,job};
    return job;
  }
  function changeView(id:string){resetWindow();setView(id);}
  async function chooseCollection(name:string){
    if(scopeKey)updateProfile({mood:"",genre:"",activity:""});
    search(name);
    const version=queueGeneration.current;
    setQueueBusy(true);setQueueStatus("Loading "+name+"…");
    await afterQueuePaint();
    if(version!==queueGeneration.current)return;
    setQueueBusy(false);setQueueStatus(name+" · 10 tracks ready.");
  }

  useEffect(()=>{
    const cacheKey="neurotype-music-catalog-v1";
    const cached=cachedTracks(stored(cacheKey));
    setCatalog(mergeTracks(cached));
    const controller=new AbortController();
    async function refresh() {
      try {
        const response=await fetch("/api/focus-music",{signal:controller.signal});
        if(!response.ok)return;
        const fresh=channelTracks(await response.text());
        if(!fresh.length || controller.signal.aborted)return;
        const byId=new Map([...cached,...fresh].map(t=>[t.id,t]));
        const recent=[...new Set([...fresh,...cached].map(t=>t.id))].slice(0,23).map(id=>byId.get(id)!);
        const retained=cached.find(t=>t.id===currentTrackId.current);
        if(retained && !recent.some(t=>t.id===retained.id))recent.push(retained);
        persist(cacheKey,JSON.stringify(recent));
        setCatalog(mergeTracks(recent));
      } catch { /* Cached and curated tracks remain available. */ }
    }
    refresh();
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    setMiniHost(document.getElementById(editorOpen?"editor-music-slot":"nav-music-slot"));
  },[editorOpen]);
  useEffect(()=>{
    if(trackList.current)trackList.current.scrollTop=0;
  },[profile.mood,profile.genre,profile.activity,profile.query,view]);

  function update(values:Partial<Preferences>) {
    if(Object.keys(values).some(key=>key!=="trackId")){resetRemote();setView("queue");}
    if(values.genre)reader.apply({type:"observeGenre",value:values.genre});
    updateProfile(values);
  }
  function search(value:string){
    resetRemote();setView("queue");
    if(scopeKey)updateProfile({query:value});
    else setEarlyQuery(value);
  }
  function select(track:Track,learn=true,continuing=false) {
    if(!catalog.some(t=>t.id===track.id)){
      setLastVideo(track);
      persist(remoteKey,JSON.stringify({track,expires:Date.now()+86400000}));
    }
    if(!continuing && queueBusy && preparing.current?.id!==track.id){
      queueGeneration.current++;preparing.current=null;setQueueBusy(false);setQueueStatus("");
    }
    if(!continuing && queue.at(-1)?.id===track.id)void prepare(track);
    else if(!continuing && view==="queue" && !activePage)setWindowPage({key,items:queue,pool:distinctTracks([...basePool,...queue])});
    if(learn)reader.apply({type:"observeGenre",value:track.genre});
    update({trackId:track.id});
    audio.load(track.id);
  }
  const audio=useYouTube(initialId,()=>step(1,false),id=>{
    change(lib=>markPlayed(lib,id));
    if(queue.at(-1)?.id===id)void prepare(queue[queue.length-1]);
  },selected.id);
  function togglePlayback() {
    if(audio.playing)audio.pause();
    else if(queue.length && !queue.some(t=>t.id===selected.id))select(queue[0]);
    else {
      reader.apply({type:"observeGenre",value:selected.genre});
      audio.resume(selected.id);
    }
  }
  async function step(direction:number,learn=true) {
    if(direction>0 && queue.at(-1)?.id===selected.id){
      const version=queueGeneration.current;
      const page=await prepare(selected);
      if(!page || version!==queueGeneration.current || !page.items[1])return;
      setView("queue");setWindowPage(page);select(page.items[1],learn,true);
      return;
    }
    const track=adjacent(queue,selected.id,direction);
    if(track)select(track,learn);
  }
  function openShelf() {
    if(editorOpen)closeEditor();
    requestAnimationFrame(()=>{
      heading.current?.focus({preventScroll:true});
      heading.current?.scrollIntoView({block:"start",behavior:"instant"});
    });
  }
  const level=audio.muted?0:audio.volume;
  const volumeStyle={"--volume":level+"%"} as CSSProperties;
  const trackLabel=selected.title+" · "+selected.artist;
  const mini=<div ref={miniRef} className="mini-audio" role="group" aria-label="Focus music" data-open={miniOpen} onKeyDown={event=>{
    if(event.key==="Escape" && miniOpen){event.stopPropagation();event.preventDefault();setMiniOpen(false);toggleButton.current?.focus();}
  }}>
    <div className="mini-switches">
      <button type="button" ref={toggleButton} className="music-toggle" aria-label="Music controls" title="Music controls"
        aria-expanded={miniOpen} aria-controls="mini-transport" onClick={()=>setMiniOpen(!miniOpen)}><span className="music-meter" aria-hidden="true" data-active={audio.playing && !audio.muted && audio.volume>0}><i/><i/><i/><i/></span></button>
      <button type="button" aria-label={audio.muted?"Unmute music":"Mute music"} title={audio.muted?"Unmute music":"Mute music"} onClick={audio.toggleMute}><MusicIcon name={audio.muted?"muted":"sound"}/></button>
    </div>
    <div id="mini-transport" className="mini-drawer" inert={!miniOpen} aria-hidden={!miniOpen}>
      <div className="mini-row">
        <button type="button" className="mini-track" title={(audio.notice || trackLabel)+" — Open music player"} aria-label={"Open music player · "+trackLabel} onClick={openShelf}>
          <span className="mini-window" aria-hidden="true"><span key={selected.id} className="mini-ribbon">
            {[0,1].map(i=><span key={i}><b>{selected.title}</b> · {selected.artist}</span>)}
          </span></span>
          <MusicIcon name="expand"/>
          {audio.notice && <span className="mini-notice">Open player for help</span>}
        </button>
        <div className="mini-playback">
          <button type="button" aria-label="Previous track" title="Previous track" disabled={!queue.length} onClick={()=>step(-1)}><MusicIcon name="previous"/></button>
          <button type="button" className="mini-play" aria-label={audio.playing?"Pause music":"Play music"} title={audio.playing?"Pause music":"Play music"} onClick={togglePlayback}><MusicIcon name={audio.playing?"pause":"play"}/></button>
          <button type="button" aria-label="Next track" title="Next track" disabled={!queue.length} onClick={()=>step(1)}><MusicIcon name="next"/></button>
        </div>
        <input className="mini-volume volume-range" style={volumeStyle} type="range" aria-label="Music volume" min="0" max="100" value={audio.muted?0:audio.volume}
          onChange={event=>audio.setVolume(Number(event.target.value))}/>
      </div>
    </div>

  </div>;

  return <section id="focus-audio" className="focus-audio outlined-section" aria-labelledby="audio-heading">
    {miniHost && createPortal(mini,miniHost)}
    <div className="audio-header">
      <div><h2 id="audio-heading" tabIndex={-1} ref={heading}>Focus audio</h2>
        <p>Choose a track to start listening. Shape the queue around your reading session.</p></div>
      <a href="https://www.youtube.com/@MindAmend/playlists" target="_blank" rel="noreferrer">Mind Amend playlists ↗</a>
    </div>
    <form className="audio-toolbar" aria-label="Search YouTube music" onSubmit={e=>{e.preventDefault();void searchYouTube(searchSpec);}}>
      <label className="music-search">Search focus music
        <input type="search" maxLength={100} value={query} aria-controls="focus-queue" placeholder="Track, artist, sound or activity" onChange={e=>search(e.target.value)}/>
      </label>
      {filterNames.map(key=><label key={key}>{key}<select value={profile[key]} onChange={e=>update({[key]:e.target.value})}>
        <option value="">Any {key}</option>{filters[key].map(option=><option key={option}>{option}</option>)}
      </select></label>)}
      <button type="submit" className="search-youtube" disabled={remoteBusy}>Search YouTube</button>
    </form>
    <div className="music-suggestions" aria-label="Suggested music searches">
      {suggestions.map(term=><button type="button" key={term} aria-pressed={query===term} onClick={()=>void chooseCollection(term)}>{term}</button>)}
    </div>
    <div className="youtube-results-info">
      <span role="status">{remoteBusy?"Searching YouTube…":remoteError || (remote?.source==="youtube"
        ?(remote.tracks.length?"YouTube search · "+remote.tracks.length+" videos":"No videos returned by YouTube. Showing library matches.")
        :remote?.source==="channels"?(remote.tracks.length
          ?"Recent YouTube uploads · "+remote.tracks.length+" matches from featured channels"
          :"No matches in recent uploads from featured YouTube channels. Showing library matches.")
        :remote?.source==="unavailable"?"Live YouTube results are unavailable. Showing library matches.":"")}</span>
      {remote?.reason==="sign-in" && <a href="/signin-with-chatgpt?return_to=%2F%23focus-audio" target="_top">Sign in to search all of YouTube</a>}
      {remote?.reason==="daily-limit" && <span role="status">Daily YouTube search limit reached. Fresh searches resume at midnight Pacific.</span>}
      {canSearch && <a href={"https://www.youtube.com/results?"+new URLSearchParams({search_query:terms})} target="_blank" rel="noreferrer">View search on YouTube ↗</a>}
    </div>
    {Boolean(syncMessage || canImport) && <div className="music-sync">
      {syncMessage && <span role="status">{syncMessage}</span>}
      {canImport && <button type="button" onClick={importDeviceLibrary}>Import playlists from this device</button>}
    </div>}
    <QueueLibrary key={scopeKey} library={library} change={change} saved={saved} view={view} setView={changeView} queueBusy={queueBusy} queueStatus={queueStatus || (view==="queue" && basePool.length>0 && basePool.length<10?"Includes related tracks to fill your queue.":"")}
      queue={queue} selected={selected} catalog={suggestedCatalog} select={select} listRef={trackList}
      query={view==="queue"?query.trim():""} playing={audio.playing}
      filtered={filterNames.some(k=>Boolean(profile[k]))} resetFilters={()=>update({...defaults,query,trackId:selected.id})} clearSearch={()=>search("")}
      transport={<div className="master-transport">
        <div className="master-track">
          <div className="master-meter" data-muted={audio.muted} title={audio.playing?(audio.muted?"Playing muted":"Playing"):"Playback paused"}>
            <span className="music-meter" aria-hidden="true" data-active={audio.playing}><i/><i/><i/><i/></span>
          </div>
          <div><strong>{selected.title}</strong><span>{selected.artist}</span></div>
        </div>
        <div className="master-playback" role="group" aria-label="Playback">
          <button type="button" aria-label="Previous track" disabled={!queue.length} onClick={()=>step(-1)}><MusicIcon name="previous"/></button>
          <button type="button" className="master-play" aria-label={audio.playing?"Pause music":"Play music"} onClick={togglePlayback}><MusicIcon name={audio.playing?"pause":"play"}/></button>
          <button type="button" aria-label="Next track" disabled={!queue.length} onClick={()=>step(1)}><MusicIcon name="next"/></button>
        </div>
        <div className="master-volume">
          <button type="button" aria-label={audio.muted?"Unmute music":"Mute music"} onClick={audio.toggleMute}><MusicIcon name={audio.muted?"muted":"sound"}/></button>
          <input className="volume-range" style={volumeStyle} type="range" aria-label="Player volume" min="0" max="100" value={audio.muted?0:audio.volume} aria-valuetext={(audio.muted?0:audio.volume)+" percent"}
            onChange={e=>audio.setVolume(Number(e.target.value))}/>
        </div>
      </div>}>
      <div className="audio-player">
        <div ref={audio.host} className="video-mount"/>
        <div className="audio-caption"><a href={"https://www.youtube.com/watch?v="+selected.id} target="_blank" rel="noreferrer">Listen on YouTube ↗</a></div>
        {audio.notice && <p className="playback-notice" role="status">{audio.notice}</p>}
      </div>
    </QueueLibrary>
  </section>;
}
