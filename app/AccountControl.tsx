import {useEffect,useRef,useState} from "react";
import ReaderModal from "./ReaderModal";
import AccountIcon,{type IconName} from "./AccountIcon";
import {DeleteView,FeedbackView,HistoryView,StatusView} from "./AccountViews";
import ReaderDisclaimer from "./ReaderDisclaimer";
import ReaderPreferences from "./ReaderPreferences";
import {useStandardYouTube,chooseStandardYouTube} from "./youtubePreference";
import "./accountPanel.css";

type Account={user:{id:string;email:string|null;name:string}|null;reviewer:boolean;signIn:string;signOut:string};
const titles={home:"Reader account",status:"Account status",preferences:"My preferences",feedback:"Submit feedback",history:"Account history",disclaimer:"Disclaimer",delete:"Delete account"};
type View=keyof typeof titles;
const destinations: {view:"status"|"preferences"|"feedback"|"history";icon:IconName}[]=[
  {view:"status",icon:"status"},{view:"preferences",icon:"preferences"},{view:"feedback",icon:"feedback"},{view:"history",icon:"history"}
];

export default function AccountControl({menuLabel=false}:{menuLabel?:boolean}){
  const [open,setOpen]=useState(false);
  const [view,setView]=useState<View>("home");
  const [returnTo,setReturnTo]=useState<"home"|"feedback">("home");
  const [account,setAccount]=useState<Account|null>(null);
  const [failed,setFailed]=useState(false);
  const focusTarget=useRef<HTMLDivElement>(null);
  const standard=useStandardYouTube();
  useEffect(()=>{
    if(!open)return;
    const abort=new AbortController();
    setFailed(false);
    fetch("/api/account",{cache:"no-store",signal:abort.signal}).then(async response=>{
      if(!response.ok)throw Error();return response.json() as Promise<Account>;
    }).then(data=>{if(!abort.signal.aborted)setAccount(data);}).catch(()=>{if(!abort.signal.aborted){setAccount(null);setFailed(true);}});
    return ()=>abort.abort();
  },[open]);
  useEffect(()=>{if(view!=="home")focusTarget.current?.focus({preventScroll:true});},[view]);
  function disclaimer(from:"home"|"feedback"){setReturnTo(from);setView("disclaimer");}
  const guest=<div className="acct-signin"><AccountIcon name="profile"/><div><h3>Sign in to your reader account</h3><p>Save your preferences across devices and manage your account activity.</p>{account && <a className="account-primary" href={account.signIn} target="_top">Sign in or create an account</a>}</div></div>;
  const identity=account?.user;
  const feedbackVisible=view==="feedback" || (view==="disclaimer" && returnTo==="feedback");

  return <><button type="button" className="account-trigger" aria-label="Reader account" aria-haspopup="dialog" title="Reader account" onClick={()=>{setView("home");setOpen(true);}}><AccountIcon name="profile"/>{menuLabel && "Reader account"}</button>
  {open && <ReaderModal title={titles[view]} close={()=>setOpen(false)} className="account-sheet">
    <div className="account-body" ref={focusTarget} tabIndex={-1} aria-label={titles[view]}>
      {view!=="home" && <button className="account-back" type="button" onClick={()=>setView(view==="disclaimer"?returnTo:"home")}>‹ {view==="disclaimer" && returnTo==="feedback"?"Feedback":"Reader account"}</button>}
      {view==="home" && <div className="account-view">
        {identity && account?<div className="account-identity"><AccountIcon name="profile"/><div><h3>{identity.name || "Reader profile"}</h3>{identity.name!==identity.email && <p>{identity.email}</p>}</div><a href={account.signOut} target="_top">Sign out</a></div>:account?guest:<p role="status">{failed?"Account details are unavailable. Reopen this panel to retry.":"Checking your account…"}</p>}
        <div className="account-destinations">{destinations.map(({view:dest,icon})=><button key={dest} type="button" onClick={()=>setView(dest)}><AccountIcon name={icon}/><span>{titles[dest]}</span><span aria-hidden="true">›</span></button>)}</div>
        <details className="playback-disclosure"><summary><AccountIcon name="playback"/>YouTube playback<span aria-hidden="true">⌄</span></summary><div>
          <label className="youtube-choice"><input type="checkbox" checked={standard} onChange={e=>chooseStandardYouTube(e.target.checked)}/>Use the standard YouTube player on this device</label>
          <p>Privacy-enhanced playback is the default. The standard player can use your YouTube session and watch-history settings when your browser allows it.</p><a href="https://www.youtube.com/feed/history" target="_blank" rel="noreferrer">View history on YouTube ↗</a>
        </div></details>
        <div className="acct-footer"><a href="/appeal#policy"><AccountIcon name="policy"/>Site policy</a><button type="button" onClick={()=>disclaimer("home")}>Disclaimer</button>{account?.reviewer && <a href="/moderation"><AccountIcon name="inbox"/>Developer inbox</a>}{identity && <button type="button" className="acct-delete-link" onClick={()=>setView("delete")}><AccountIcon name="delete"/>Delete account</button>}</div>
      </div>}
      {view==="preferences" && <div className="account-view"><ReaderPreferences/></div>}
      {view==="status" && <div className="account-view">{identity?<StatusView/>:guest}</div>}
      {view==="history" && <div className="account-view">{identity?<HistoryView/>:guest}</div>}
      {feedbackVisible && <div className="account-view" hidden={view!=="feedback"}>{identity?<FeedbackView showDisclaimer={()=>disclaimer("feedback")}/>:guest}</div>}
      {view==="disclaimer" && <div className="account-view"><ReaderDisclaimer/></div>}
      {view==="delete" && identity && account && <div className="account-view"><DeleteView id={identity.id} signOut={account.signOut}/></div>}
    </div>
  </ReaderModal>}</>;
}
