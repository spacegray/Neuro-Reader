import {useEffect, useRef, useState} from "react";

import {createPortal} from "react-dom";
import AccountControl from "./AccountControl";

import {sections} from "./pageSections";

const groups=[{name:"Reading workspace",links:sections.slice(0,4)},{name:"Research & discovery",links:sections.slice(4,9)},{name:"Listening",links:sections.slice(9)}];

export default function HeaderActions({mode, theme, setMode}:{
  mode:string; theme:"light"|"dark"; setMode:(value:string)=>void;
}) {
  const [open, setOpen] = useState(false);
  const disclosure = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const [dock,setDock]=useState<HTMLElement|null>(null);
  const [compact,setCompact]=useState(false);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    setDock(document.getElementById("nav-music-slot"));
    const onScroll=()=>{setCompact(window.scrollY>80);setExpanded(false);};
    onScroll();
    window.addEventListener("scroll",onScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[]);
  useEffect(()=>{
    if (!open) return;
    function dismiss(event:Event) {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return ()=>{
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  },[open]);

  return <div className="nav-actions">

    <div className="section-nav" ref={disclosure} onKeyDown={event=>{
      if (open && event.key==="Escape") {setOpen(false); trigger.current?.focus();}
    }}>
      <button type="button" className="section-trigger" aria-expanded={open} aria-controls="section-links"
        aria-label="Reader menu" title="Reader menu" ref={trigger} onClick={()=>setOpen(!open)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={open?"m6 6 12 12M18 6 6 18":"M4 6h16M4 12h16M4 18h16"}/>
        </svg>
      </button>
      <div className="section-links" id="section-links" hidden={!open}>
        {groups.map(({name,links})=>
          <details key={name} open={name==="Reading workspace"}><summary>{name}</summary>
            {links.map(([id,name])=><a key={id} href={"#"+id} onClick={()=>setOpen(false)}>{name}</a>)}</details>)}
        <AccountControl menuLabel/>
        <label className="auto-theme"><input type="checkbox" checked={mode==="auto"}
          onChange={event=>setMode(event.target.checked?"auto":theme)}/>Automatic day/night</label>
      </div>
    </div>
    {dock && createPortal(<div className="appearance-icons appearance-dock" role="group" aria-label="Appearance" data-compact={compact && !expanded}
      onMouseEnter={()=>setExpanded(true)} onMouseLeave={e=>{if(!e.currentTarget.contains(document.activeElement))setExpanded(false);}}
      onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setExpanded(false);}}
      onKeyDown={e=>{if(e.key==="Escape")setExpanded(false);}}>
      {(["light","dark"] as const).map(value=><button type="button" key={value} data-mode={value}
        aria-label={value==="light"?"Light appearance":"Dark appearance"} aria-pressed={theme===value}
        title={(value==="light"?"Light":"Dark")+(mode==="auto" && theme===value?" · automatic":"")}
        onFocus={()=>setExpanded(true)} onClick={()=>{setExpanded(true);setMode(value);}}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {value==="light"?<><circle cx="12" cy="12" r="3.8" fill="currentColor"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></>:<path fill="currentColor" d="M20.6 14.7A8.9 8.9 0 0 1 9.3 3.4a9 9 0 1 0 11.3 11.3Z"/>}
        </svg>
      </button>)}
    </div>,dock)}
  </div>;
}
