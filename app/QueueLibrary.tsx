import {useRef,useState,type FormEvent,type ReactNode,type RefObject} from "react";
import {playlistLimit,recommendations,type MusicLibrary} from "./listeningLibrary";
import AudioLayout from "./AudioLayout";
import ReaderModal from "./ReaderModal";
import type {Track} from "./musicLibrary";

type Props={
  library:MusicLibrary;change:(edit:(lib:MusicLibrary)=>MusicLibrary)=>void;
  view:string;setView:(value:string)=>void;queue:Track[];selected:Track;catalog:Track[];
  select:(track:Track)=>void;listRef:RefObject<HTMLDivElement|null>;saved:boolean;
  queueBusy:boolean;queueStatus:string;query:string;playing:boolean;clearSearch:()=>void;filtered:boolean;resetFilters:()=>void;transport:ReactNode;children:ReactNode;
};
export default function QueueLibrary({library,change,view,setView,queue,selected,catalog,select,listRef,saved,query,playing,queueBusy,queueStatus,clearSearch,filtered,resetFilters,transport,children}:Props) {
  const [collectionOpen,setCollectionOpen]=useState(false);
  const openButton=useRef<HTMLButtonElement>(null);
  const queuePicker=useRef<HTMLSelectElement>(null);
  const [action,setAction]=useState<"new"|"rename"|null>(null);
  const [name,setName]=useState("");
  const [pending,setPending]=useState<Track|null>(null);
  const [page,setPage]=useState(0);
  const [message,setMessage]=useState("");
  const mix=library.mixes.find(item=>item.id===view);
  const favorites=new Set(library.favorites.map(t=>t.id));
  const played=new Set(library.played);
  const similar=mix?recommendations(catalog,mix.tracks,selected):[];
  const pages=Math.max(1,Math.ceil(similar.length/3));
  const start=(page%pages)*3;
  function navigate(id:string){
    setView(id);setAction(null);setPending(null);setMessage("");setPage(0);
  }
  function add(id:string,track:Track) {
    change(lib=>({...lib,mixes:lib.mixes.map(m=>m.id!==id || m.tracks.some(t=>t.id===track.id)?m:{...m,tracks:[...m.tracks,track]})}));
    setMessage("Added “"+track.title+"” to "+library.mixes.find(m=>m.id===id)?.name+".");
    setPending(null);
  }
  function submit(e:FormEvent){
    e.preventDefault();
    const label=name.trim();
    if(!label)return;
    if(action==="rename" && mix){
      change(lib=>({...lib,mixes:lib.mixes.map(m=>m.id===mix.id?{...m,name:label}:m)}));
      setAction(null);return;
    }
    if(library.mixes.length>=playlistLimit)return;
    const id=crypto.randomUUID();
    change(lib=>lib.mixes.length>=playlistLimit?lib:{...lib,mixes:[...lib.mixes,{id,name:label,tracks:pending?[pending]:[]}]});
    navigate(id);setMessage("Created “"+label+"”.");
  }
  function removeTrack(track:Track) {
    change(lib=>({...lib,mixes:lib.mixes.map(m=>m.id===view?{...m,tracks:m.tracks.filter(t=>t.id!==track.id)}:m)}));
    setMessage("Removed “"+track.title+"” from this playlist.");
  }
  function chooseTrackDestination(track:Track) {
    setAction(null);setPending(track);setMessage("");
    if(!library.mixes.length){setName("");setAction("new");}
  }
  const viewName=mix?.name || (view==="favorites"?"Favorite tracks":"Your queue");
  const currentInMix=Boolean(mix?.tracks.some(t=>t.id===selected.id));
  const playlistControls=<div className="collection-tools master-playlists" role="group" aria-label="Playlist management">
    <select ref={queuePicker} aria-label="Choose queue or playlist" value={view} onChange={e=>navigate(e.target.value)}>
      <option value="queue">Your queue</option><option value="favorites">Favorite tracks</option>
      {library.mixes.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
    <button type="button" disabled={library.mixes.length>=playlistLimit} onClick={()=>{setPending(null);setName("");setAction("new");}}>+ New playlist</button>
    <button type="button" aria-label={(currentInMix?"Remove current track from ":"Add current track to ")+(mix?.name || "a playlist")}
      onClick={()=>{if(!mix)chooseTrackDestination(selected);else if(currentInMix)removeTrack(selected);else add(mix.id,selected);}}>
      {currentInMix?"− Remove track":"+ Add track"}
    </button>
    {mix && <>
      <button type="button" onClick={()=>{setPending(null);setName(mix.name);setAction("rename");}}>Rename</button>
      <button type="button" onClick={()=>{
        if(window.confirm("Delete “"+mix.name+"”?")){change(lib=>({...lib,mixes:lib.mixes.filter(m=>m.id!==mix.id)}));navigate("queue");}
      }}>Delete playlist</button>
    </>}
    {!collectionOpen && (mix || view==="favorites") && <button ref={openButton} className="open-collection" type="button" aria-haspopup="dialog"
      onClick={()=>{setPending(null);setAction(null);setCollectionOpen(true);}}>Open collection</button>}
  </div>;
  const picker=<>
    {pending && !action && <div className="collection-picker">
      <label>Add “{pending.title}” to
        <select autoFocus aria-label="Destination playlist" value="" onChange={e=>{if(e.target.value==="new"){setName("");setAction("new");}else add(e.target.value,pending);}}>
          <option value="" disabled>Choose a playlist</option>
          {library.mixes.map(m=><option key={m.id} value={m.id} disabled={m.tracks.some(t=>t.id===pending.id)}>{m.name}</option>)}
          {library.mixes.length<playlistLimit && <option value="new">+ New playlist</option>}
        </select></label><button type="button" onClick={()=>setPending(null)}>Cancel</button></div>}
    {action && <form className="collection-picker" onSubmit={submit}><label>{action==="new"?"New playlist name":"Playlist name"}
      <input autoFocus maxLength={60} required value={name} onChange={e=>setName(e.target.value)}/></label>
      <button type="submit" disabled={!name.trim()}>{action==="new"?"Create":"Save name"}</button><button type="button" onClick={()=>{setAction(null);setPending(null);}}>Cancel</button></form>}
  </>;
  const listing=<div className="queue-panel" id="focus-queue">
    <div className="queue-heading"><h3 id="queue-title" tabIndex={-1}>{query?"Search results":viewName}</h3><div className="queue-count">
      <span role="status" aria-live="polite" aria-atomic="true">{queue.length} {queue.length===1?"track":"tracks"}</span>
      <button type="button" title="Clear played history" aria-label="Clear played history" disabled={!played.size}
        onClick={()=>{change(lib=>({...lib,played:[],started:0}));setMessage("Played history cleared.");}}>↺</button>
    </div></div>
    <div className="queue-loading" role="status">{queueBusy && <progress aria-label="Loading tracks"/>}{queueStatus}</div>
    {query && <div className="queue-query"><span>For “{query}”</span><button type="button" onClick={clearSearch}>Clear search</button></div>}
    <div ref={listRef} className="audio-tracks" role="group" aria-label="Choose a focus track">
      {queue.map((track,index)=><div className="library-track" key={track.id} data-played={played.has(track.id)} data-playing={playing && selected.id===track.id} data-current={selected.id===track.id}>
        <button type="button" className="track-main" aria-pressed={selected.id===track.id} onClick={()=>select(track)}>
          <span className="track-symbol" aria-hidden="true">{selected.id===track.id?"♫":String(index+1).padStart(2,"0")}</span>
          <span><strong>{track.title}</strong><span>{track.genre} · {track.format}{playing && selected.id===track.id?" · Playing":played.has(track.id)?" · Played":""}</span></span></button>
        <button className="track-icon" type="button" aria-label={"Favorite "+track.title} aria-pressed={favorites.has(track.id)}
          onClick={()=>change(lib=>({...lib,favorites:lib.favorites.some(t=>t.id===track.id)?lib.favorites.filter(t=>t.id!==track.id):[...lib.favorites,track]}))}>{favorites.has(track.id)?"♥":"♡"}</button>
        <button className="track-icon" type="button" aria-label={(mix?"Remove from playlist: ":"Add to playlist: ")+track.title}
          onClick={()=>{if(mix){removeTrack(track);return;}chooseTrackDestination(track);}}>{mix?"−":"+"}</button>
      </div>)}
      {!queue.length && <p>{mix?"Add a suggested track, or choose tracks from Your queue.":view==="favorites"?"Heart a track to save it here.":query?(filtered?"No matching tracks with these filters. Reset filters to search more tracks.":"No matching tracks in your music library. Try another title, artist or genre."):"No tracks match this combination."}</p>}
    </div>
    {mix && similar.length>0 && <div className="music-recs"><h4>Suggested for this playlist</h4><div>
      {similar.slice(start,start+3).map(t=><button type="button" key={t.id} aria-label={"Add "+t.title} onClick={()=>add(mix.id,t)}>+ {t.title}</button>)}
      {pages>1 && <button type="button" className="find-more" onClick={()=>setPage(p=>(p+1)%pages)}>Find more ↻</button>}</div></div>}
    {filtered && view==="queue" && <button type="button" className="reset-music" onClick={resetFilters}>Reset filters</button>}
    <div className="track-legend" aria-label="Track colors"><span title="Played in the last 12-hour session"><i aria-hidden="true"/>Played</span><span><i aria-hidden="true"/>Playing</span></div>
  </div>;
  function closeCollection() {
    setCollectionOpen(false);setAction(null);setPending(null);
    requestAnimationFrame(()=>(openButton.current || queuePicker.current)?.focus({preventScroll:true}));
  }
  const status=<div className="master-status">
    <span role="status">{message}</span>
    {!saved && <span role="alert">Saving is unavailable. Changes apply to this visit.</span>}
  </div>;
  return <>
    <AudioLayout video={children} queue={!collectionOpen && listing} controls={<section className="master-console" aria-label="Master playlist controls">
      {transport}
      {!collectionOpen && <>{playlistControls}{picker}{status}</>}
    </section>}/>
    {collectionOpen && <ReaderModal title="Playlist collection" close={closeCollection}>
      <div className="playlist-collection">{transport}{playlistControls}{picker}{listing}{status}</div>
    </ReaderModal>}
  </>;
}
