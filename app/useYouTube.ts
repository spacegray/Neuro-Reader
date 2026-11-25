import {useEffect,useRef,useState} from "react";

import {useStandardYouTube} from "./youtubePreference";

type Player = {
  mute:()=>void; unMute:()=>void; isMuted:()=>boolean; setVolume:(value:number)=>void; getVolume:()=>number;
  getVideoData:()=>{video_id?:string}; loadVideoById:(id:string)=>void; playVideo:()=>void; pauseVideo:()=>void; destroy:()=>void;
};
type Options = {events:{
  onReady:(e:{target:Player})=>void; onStateChange:(e:{data:number;target:Player})=>void;
  onError:()=>void; onAutoplayBlocked:()=>void;
}};
type SDK = {Player:new (frame:HTMLIFrameElement, options:Options)=>Player};
declare global {interface Window {YT?:SDK;onYouTubeIframeAPIReady?:()=>void}}
let sdkPromise:Promise<SDK>|undefined;
function youtube() {
  if(window.YT?.Player) return Promise.resolve(window.YT);
  if(!sdkPromise) sdkPromise=new Promise<SDK>((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{previous?.();if(window.YT?.Player)resolve(window.YT);};
    const script=document.createElement("script");
    script.src="https://www.youtube.com/iframe_api";
    script.onerror=()=>{sdkPromise=undefined;script.remove();reject(new Error("YouTube unavailable"));};
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function useYouTube(initialId:string|null,onEnd:()=>void,onPlayed:(id:string)=>void,selectedId?:string) {
  const standard=useStandardYouTube();
  const currentVideo=useRef(selectedId);
  useEffect(()=>{currentVideo.current=selectedId;},[selectedId]);
  const host=useRef<HTMLDivElement>(null);
  const player=useRef<Player|null>(null);
  const pending=useRef<string|null>(null);
  const sound=useRef({muted:true, volume:45});
  const lastAudible=useRef(45);
  const soundChangedAt=useRef(0);
  const userPlayback=useRef(false);
  const [levels,setLevels]=useState(sound.current);
  const ended=useRef(onEnd);
  const played=useRef(onPlayed);
  useEffect(()=>{played.current=onPlayed;},[onPlayed]);
  const [playing,setPlaying]=useState(false);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(false);
  useEffect(()=>{ended.current=onEnd;},[onEnd]);
  useEffect(()=>{
    if(!initialId || !host.current) return;
    let disposed=false;
    let instance:Player|undefined;
    let visible=false;
    let autoAttempted=false;
    let volumeWatch:number|undefined;
    function tryAutoplay() {
      if(!player.current || !visible || document.hidden || document.querySelector("dialog[open]") || userPlayback.current || autoAttempted)return;
      autoAttempted=true;
      player.current.playVideo();
    }
    const frame=document.createElement("iframe");
    frame.title="Focus audio · YouTube music player";
    frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen=true;
    frame.referrerPolicy="strict-origin-when-cross-origin";
    setPlaying(false);setLoading(false);
    const origin=standard?"https://www.youtube.com":"https://www.youtube-nocookie.com";
    frame.src=origin+"/embed/"+(currentVideo.current || initialId)+"?enablejsapi=1&playsinline=1&mute=1&origin="+encodeURIComponent(window.location.origin);
    host.current.replaceChildren(frame);
    const observer=typeof IntersectionObserver==="undefined" ? null : new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting && entry.intersectionRatio>.5;
      tryAutoplay();
    },{threshold:[0,.51]});
    observer?.observe(frame);
    document.addEventListener("visibilitychange",tryAutoplay);
    document.addEventListener("close",tryAutoplay,true);
    const slow=window.setTimeout(()=>{if(!player.current)setNotice("Use the controls in the video if the music player is still connecting.");},12000);
    youtube().then(sdk=>{
      if(disposed)return;
      instance=new sdk.Player(frame,{events:{
        onReady:({target})=>{
          if(disposed)return;
          window.clearTimeout(slow);player.current=target;setNotice("");
          target.mute();
          target.setVolume(sound.current.volume);
          if(!sound.current.muted)target.unMute();
          // The embedded player also has its own sound controls.
          volumeWatch=window.setInterval(()=>{
            if(Date.now()-soundChangedAt.current<800)return;
            const volume=target.getVolume();
            if(!Number.isFinite(volume))return;
            const muted=target.isMuted() || volume===0;
            if(muted===sound.current.muted && volume===sound.current.volume)return;
            sound.current={muted,volume};
            if(volume>0)lastAudible.current=volume;
            setLevels(sound.current);
          },1000);
          if(pending.current){target.loadVideoById(pending.current);pending.current=null;}
          else tryAutoplay();
        },
        onStateChange:({data,target})=>{
          if(disposed)return;
          setPlaying(data===1);setLoading(data===3);
          if(data===1 || data===2)userPlayback.current=true;
          if(data===1){setNotice("");const id=target.getVideoData?.().video_id;if(id)played.current(id);}
          if(data===0)ended.current();
        },
        onAutoplayBlocked:()=>{if(!disposed){setPlaying(false);setLoading(false);setNotice("Press play in the video to start audio in this browser.");}},
        onError:()=>{if(!disposed){setPlaying(false);setLoading(false);setNotice("YouTube couldn’t play this track here. Try another track or its source link.");}},
      }});
    }).catch(()=>{if(!disposed){setLoading(false);setNotice("YouTube’s remote controls are unavailable. Use the video controls.");}});
    return ()=>{
      disposed=true;
      observer?.disconnect();
      document.removeEventListener("visibilitychange",tryAutoplay);
      document.removeEventListener("close",tryAutoplay,true);
      window.clearTimeout(slow);
      window.clearInterval(volumeWatch);
      player.current=null;
      instance?.destroy();
      frame.remove();
    };
  },[initialId,standard]);
  useEffect(()=>{
    if(!loading)return;
    const timer=window.setTimeout(()=>{
      setLoading(false);
      setNotice("Playback is taking longer than expected. Try play in the video, or choose another track.");
    },14000);
    return ()=>window.clearTimeout(timer);
  },[loading]);
  const load=(id:string)=>{
    userPlayback.current=true;
    setNotice("");setPlaying(false);setLoading(true);
    if(player.current){player.current.loadVideoById(id);}
    else {
      pending.current=id;
      // Keep the native embed usable even if the API script is blocked.
      const frame=host.current?.querySelector("iframe");
      if(frame){const url=new URL(frame.src);url.pathname="/embed/"+id;url.searchParams.set("autoplay","1");url.searchParams.set("mute",sound.current.muted?"1":"0");frame.src=url.href;}
    }
  };
  const resume=(id:string)=>{
    userPlayback.current=true;
    if(player.current)player.current.playVideo();else load(id);
  };
  const pause=()=>{
    userPlayback.current=true;pending.current=null;player.current?.pauseVideo();setLoading(false);
  };
  function changeSound(muted:boolean,volume:number) {
    soundChangedAt.current=Date.now();
    if(volume>0)lastAudible.current=volume;
    sound.current={muted,volume};
    setLevels(sound.current);
    if(muted)player.current?.mute();
    player.current?.setVolume(volume);
    if(!muted)player.current?.unMute();
  }
  function toggleMute() {
    const {muted,volume}=sound.current;
    changeSound(!muted,volume || lastAudible.current);
  }
  function setVolume(volume:number) {
    changeSound(volume===0,volume);
  }
  return {host,playing,loading,notice,load,resume,pause,...levels,toggleMute,setVolume};
}
