import {useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent} from "react";

type Props = {split:number; saveSplit:(value:number)=>void; quiet:boolean; children:ReactNode};

export default function ReaderComparison({split,saveSplit,quiet,children}:Props) {
  const workspace=useRef<HTMLElement>(null);
  const pointer=useRef<number|null>(null);
  const interacted=useRef(false);
  const [drag,setDrag]=useState<number|null>(null);
  const [hint,setHint]=useState(false);
  const position=drag ?? split;

  useEffect(()=>{
    const node=workspace.current;
    if(!node || quiet || split!==50)return;
    function onScroll() {
      if(!node || interacted.current || !window.matchMedia("(max-width:700px) and (prefers-reduced-motion:no-preference)").matches)return;
      const box=node.getBoundingClientRect();
      if(Math.min(box.bottom,window.innerHeight)-Math.max(box.top,0)<Math.min(100,box.height*.45))return;
      setHint(true);
      document.removeEventListener("scroll",onScroll,true);
    }
    document.addEventListener("scroll",onScroll,{capture:true,passive:true});
    return ()=>document.removeEventListener("scroll",onScroll,true);
  },[quiet,split]);

  function interact() {
    interacted.current=true;
    setHint(false);
  }
  function choose(value:number) {
    interact();
    setDrag(null);
    saveSplit(Math.max(0,Math.min(100,value)));
  }
  function percent(event:PointerEvent) {
    const box=workspace.current!.getBoundingClientRect();
    const x=event.clientX-box.left;
    if(x<=16)return 0;
    if(box.width-x<=16)return 100;
    return Math.round(100*x/box.width);
  }
  return <>
    <div id="reader" className="reader-switch" role="group" aria-label="Reader view">
      {([[100,"Edit text"],[50,"Compare"],[0,"Focus view"]] as const).map(([value,label])=>
        <button key={label} aria-pressed={value===50 ? position>0 && position<100 : position===value}
          aria-controls="reader-workspace" onClick={()=>choose(value)}>{label}</button>)}
    </div>
    <section ref={workspace} id="reader-workspace" className="workspace" aria-label="Bionic reading workspace"
      style={{"--reveal":position+"%"} as CSSProperties} data-hint={hint} data-split={position}
      onAnimationEnd={event=>{if(event.animationName==="compare-peek")setHint(false);}}>
      {children}
      <div className="comparison-divider" tabIndex={0} role="slider" aria-label="Compare original and focus text"
        aria-controls="input-panel output-panel" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={position} aria-valuetext={position+" percent original text, "+(100-position)+" percent focus view"}
        onKeyDown={event=>{
          const values:Record<string,number>={ArrowLeft:position-5,ArrowRight:position+5,Home:0,End:100};
          if(event.key in values){event.preventDefault();choose(values[event.key]);}
        }}
        onPointerDown={event=>{
          if(!event.isPrimary || event.button!==0)return;
          interact();
          pointer.current=event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event=>{if(pointer.current===event.pointerId)setDrag(percent(event));}}
        onPointerUp={event=>{
          if(pointer.current!==event.pointerId)return;
          pointer.current=null;
          if(drag!==null)choose(percent(event));
        }}
        onLostPointerCapture={()=>{pointer.current=null;setDrag(null);}}>
        <span aria-hidden="true">‹ ›</span>
      </div>
    </section>
  </>;
}
