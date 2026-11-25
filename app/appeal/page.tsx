"use client";
import {useEffect,useState,type FormEvent} from "react";
import {HistoryView,StatusView} from "../AccountViews";
import {blockedMessage} from "../moderation/policy";
import "../moderation/review.css";

type AppealStatus={signedIn:boolean;blocked:boolean;last?:{status:string}|null};
export default function Appeals(){
  const [status,setStatus]=useState<AppealStatus|null>(null);
  const [message,setMessage]=useState(""),[documentation,setDoc]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;fetch("/api/moderation/appeal",{cache:"no-store"}).then(async r=>{
    if(!r.ok)throw Error();const data=await r.json() as AppealStatus;if(live)setStatus(data);
  }).catch(()=>{if(live)setNotice("Your account status could not be loaded. Please refresh to try again.");});return ()=>{live=false;};},[]);
  async function send(e:FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setNotice("");
    try {
      const r=await fetch("/api/moderation/appeal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,documentation})});
      const data=await r.json() as {error?:string};
      if(!r.ok){setNotice(data.error || "Please try again.");return;}
      setStatus(s=>s?{...s,last:{status:"pending"}}:s);setMessage("");setDoc("");setNotice("Your appeal has been sent to the site developer.");
    }catch{setNotice("Your appeal could not be sent. Please try again.");}finally{setBusy(false);}
  }
  return <main className="review-page"><article><a href="/">Neurotype Reader</a>
    <h1>{status?.blocked?"Account review":"Search policy and appeals"}</h1>
    {status?.blocked && <p>{blockedMessage} If you believe this was a mistake, you can ask the site developer to review it.</p>}
    {status?.blocked && <section aria-label="Account status" className="recovery-status"><StatusView/>
      <details><summary>My reports and correspondence</summary><HistoryView/></details></section>}
    <section id="policy"><h2>Search policy</h2><p>Use discovery to explore neurodivergence and reading. Keep queries appropriate for a general audience. Requests for explicit material, targeted threats, harassment, and abusive language are filtered. Respectful questions about difficult experiences are welcome.</p>
    <p>When a rule matches, the site reports its category, match confidence and time to the developer’s private moderation inbox. Signed-in reports are linked to the site account. Reports omit the search text. Three separate high-confidence threat or targeted-abuse incidents in a week can restrict access across the account’s verified email addresses. Duplicate attempts in a ten-minute period count together.</p><p>Brief spikes in discovery or music API traffic can trigger a temporary pause. Sustained extreme traffic for more than ten minutes can lock access for review. Inactivity and ordinary user feedback alone cannot lock an account. Account recovery stays available during a restriction.</p></section>
    {!status?.signedIn && status && <a href="/signin-with-chatgpt?return_to=%2Fappeal" target="_top">Sign in to check your account</a>}
    {status?.blocked && <section><h2 id="contact">Contact administrator</h2><p>Use this form to request a site access review. For a password reset, use the recovery option at the service you signed in with.</p><p><a href="https://accounts.google.com/signin/recovery" target="_blank" rel="noreferrer">Google account recovery</a> · <a href="/signin-with-chatgpt?return_to=%2Fappeal" target="_top">ChatGPT sign-in</a></p>
      {status.last?.status==="pending"?<p>Your appeal is awaiting review.</p>:<>
        {status.last?.status==="declined" && <p>Your previous appeal was reviewed and the restriction remains. You can provide new information.</p>}
        <form onSubmit={send}><label>Comments<textarea required minLength={12} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} rows={5}/></label>
          <label>Supporting documentation <small>(optional, up to 500 characters)</small><textarea maxLength={500} value={documentation} onChange={e=>setDoc(e.target.value)} rows={3}/></label>
          <small>Describe the circumstances or paste a short plain-text excerpt. Omit names, medical details, links and harmful terms. One submission per day.</small>
          <button disabled={busy}>{busy?"Sending…":"Submit appeal"}</button></form></>}</section>}
    {status && status.signedIn && !status.blocked && <p>Your account has no active restriction.</p>}
    <p role="status">{notice}</p></article></main>;
}
