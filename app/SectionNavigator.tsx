import {useEffect,useState,type MouseEvent} from "react";
import {sections} from "./pageSections";
import "./sectionNavigator.css";

type Stop={id:string;label:string;top:number};
type Position={up:Stop|null;down:Stop|null;showTop:boolean};
const empty:Position={up:null,down:null,showTop:false};

function readPosition():Position{
  const y=window.scrollY;
  const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const stops:Stop[]=[];
  for(const [id,label] of sections){
    const node=document.getElementById(id);
    if(!node || !node.getClientRects().length)continue;
    const margin=Number.parseFloat(getComputedStyle(node).scrollMarginTop)||0;
    const top=id==="home"?0:Math.min(max,Math.max(0,y+node.getBoundingClientRect().top-margin));
    // Side-by-side headings are one stop until the mobile layout stacks them.
    if(stops.length && top-stops[stops.length-1].top<44)continue;
    stops.push({id,label,top});
  }
  const current=stops.findLastIndex(stop=>stop.top<=y+4);
  return {
    up:y<=4?null:stops[Math.max(0,current-1)]??null,
    down:stops[current+1]??null,
    showTop:y>window.innerHeight*.65
  };
}

export default function SectionNavigator(){
  const [position,setPosition]=useState<Position>(empty);
  useEffect(()=>{
    let frame=0;
    function update(){
      const next=readPosition();
      setPosition(prev=>prev.up?.id===next.up?.id && prev.down?.id===next.down?.id && prev.showTop===next.showTop?prev:next);
      frame=0;
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    const observer=new ResizeObserver(schedule);
    const main=document.getElementById("home");
    if(main)observer.observe(main);
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule);
    update();
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);};
  },[]);

  function go(event:MouseEvent<HTMLAnchorElement>,id:string){
    const target=document.getElementById(id);
    if(!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();
    const behavior=window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth";
    if(id==="home"){
      document.querySelector<HTMLElement>(".topbar .brand")?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior});
    }else{
      target.tabIndex=-1;
      target.focus({preventScroll:true});target.scrollIntoView({behavior,block:"start"});
    }
  }
  const {up,down,showTop}=position;
  function step(stop:Stop|null,direction:"up"|"down"){
    const name=(direction==="up"?"Previous section":"Next section")+(stop?" · "+stop.label:"");
    const icon=<svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction==="up"?"m6 14 6-6 6 6":"m6 10 6 6 6-6"}/></svg>;
    return stop?<a href={"#"+stop.id} aria-label={name} title={name} onClick={e=>go(e,stop.id)}>{icon}</a>:
      <button disabled aria-label={name}>{icon}</button>;
  }
  return <nav className="section-navigator" aria-label="Section navigation" data-ready={Boolean(up || down)}>
    <div className="section-steps">{step(up,"up")}{step(down,"down")}</div>
    <a className="section-return" href="#home" aria-label="Top of page" title="Top of page" inert={!showTop} aria-hidden={!showTop} data-visible={showTop} onClick={e=>go(e,"home")}>
      <span>Top of page</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6m-7 7 7-7 7 7M5 3h14"/></svg>
    </a>
  </nav>;
}
