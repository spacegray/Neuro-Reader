import {useSyncExternalStore} from "react";
import {stored,persist} from "./localState";

const key="neurotype-standard-youtube";
let memoryChoice:boolean|undefined;
function subscribe(notify:()=>void) {
  const sync=(event:StorageEvent)=>{if(event.key===key || event.key===null){memoryChoice=undefined;notify();}};
  window.addEventListener(key,notify);
  window.addEventListener("storage",sync);
  return ()=>{window.removeEventListener(key,notify);window.removeEventListener("storage",sync);};
}
export function useStandardYouTube(){
  return useSyncExternalStore(subscribe,()=>memoryChoice ?? stored(key)==="true",()=>false);
}
export function chooseStandardYouTube(enabled:boolean) {
  memoryChoice=enabled;persist(key,String(enabled));window.dispatchEvent(new Event(key));
}
