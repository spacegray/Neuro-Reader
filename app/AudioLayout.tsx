import {useEffect,useState,type CSSProperties,type ReactNode} from "react";
import {stored,persist} from "./localState";

const panels=["video","controls","queue"] as const;
type Panel=typeof panels[number];
const labels:Record<Panel,string>={video:"Video",controls:"Player controls",queue:"Queue"};
const storageKey="neurotype-audio-layout";
export default function AudioLayout({video,controls,queue}:{video:ReactNode;controls:ReactNode;queue:ReactNode}){
  const [order,setOrder]=useState<Panel[]>([...panels]);
  const [arranging,setArranging]=useState(false);
  const [grabbed,setGrabbed]=useState<Panel|null>(null);
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    const saved=stored(storageKey)?.split(",");
    if(saved?.length===3 && panels.every(id=>saved.includes(id)))setOrder(saved as Panel[]);
  },[]);
  function swap(a:Panel,b:Panel){
    setGrabbed(null);
    if(a===b)return;
    const next=order.map(id=>id===a?b:id===b?a:id);
    setOrder(next);persist(storageKey,next.join(","));
    setNotice(labels[a]+" swapped with "+labels[b]+".");
  }
  const content={video,controls,queue};
  return <>
    <div className="layout-tools">
      <span role="status">{arranging && (notice || "Drag a handle or choose two panels to swap.")}</span>
      <button type="button" aria-pressed={arranging} onClick={()=>{setArranging(!arranging);setGrabbed(null);setNotice("");}}>{arranging?"Done arranging":"Arrange player"}</button>
    </div>
    <div className="audio-layout moveable-layout" data-arranging={arranging}>
      {panels.map(id=><div key={id} className="audio-part" data-part={id} data-slot={order.indexOf(id)} data-grabbed={grabbed===id}
        style={{"--slot":order.indexOf(id)+1} as CSSProperties}
        onDragOver={e=>{if(arranging && grabbed)e.preventDefault();}}
        onDrop={e=>{if(arranging && grabbed){e.preventDefault();swap(grabbed,id);}}}>
        {arranging && <button type="button" className="move-panel" draggable aria-pressed={grabbed===id}
          onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",id);setGrabbed(id);}}
          onDragEnd={()=>setGrabbed(null)} onClick={()=>grabbed?swap(grabbed,id):setGrabbed(id)}>
          <span aria-hidden="true">⠿</span> {grabbed && grabbed!==id?"Swap with ":"Move "}{labels[id]}</button>}
        {content[id]}
      </div>)}
    </div>
  </>;
}
