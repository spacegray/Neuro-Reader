import {useEffect,useRef,useState,type FormEvent} from "react";
import AccountIcon from "./AccountIcon";
import {clearDeletedReaderData} from "./accountServices/localCleanup";

type AccountStatus={score:number;level:"green"|"yellow"|"orange"|"red";label:string;reasons:string[];lastActive:number|null;locked:boolean};
type HistoryRow={id:string;created:number;type:string;status:string;detail:string};
type ApiError={error?:string};
const shortDate=(ms:number)=>new Date(ms).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});

function useAccountData<T>(path:string){
  const [data,setData]=useState<T|null>(null);
  const [error,setError]=useState("");
  const [attempt,retry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setError("");setData(null);
    fetch(path,{signal:controller.signal,cache:"no-store"}).then(async r=>{
      if(!r.ok)throw Error("This information could not be loaded.");
      return r.json() as Promise<T>;
    }).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(()=>{if(!controller.signal.aborted)setError("This information could not be loaded.");});
    return ()=>controller.abort();
  },[path,attempt]);
  const fallback=error?<p role="alert">{error} <button type="button" onClick={()=>retry(n=>n+1)}>Try again</button></p>:<p role="status">Loading…</p>;
  return {data,fallback};
}

export function StatusView(){
  const {data,fallback}=useAccountData<AccountStatus>("/api/account/status");
  if(!data)return fallback;
  return <><div className="account-score" data-level={data.level}>
    <div className="score-bulb"><AccountIcon name="profile"/></div>
    <div><h3>{data.label}</h3><p>Account score <b>{data.score} / 10</b></p></div>
    </div>
    <div className="account-score-detail">
      <h3>What affects your score</h3><p>New accounts start at 10. Recent activity and confirmed site events determine the current level.</p>
      {data.reasons.length>0 && <ul>{data.reasons.map(s=><li key={s}>{s}</li>)}</ul>}
      {data.lastActive && <p className="account-fine">Last active {shortDate(data.lastActive)}</p>}
      {data.locked && <a className="account-primary" href="/appeal#contact">Contact administrator</a>}
    </div></>;
}

export function HistoryView(){
  const [page,setPage]=useState(0);
  const {data,fallback}=useAccountData<{rows:HistoryRow[];hasMore:boolean}>("/api/account/history?page="+page);
  if(!data)return fallback;
  return data.rows.length?<div className="acct-history"><table><caption className="sr-only">Your account correspondence and reports</caption><thead><tr><th>Date</th><th>Activity</th><th>Status</th></tr></thead>
    <tbody>{data.rows.map(row=><tr key={row.id}><td>{shortDate(row.created)}</td><td><b>{row.type}</b>{row.detail && <p>{row.detail}</p>}</td><td>{row.status}</td></tr>)}</tbody></table>
    {(page>0 || data.hasMore) && <nav className="account-pagination" aria-label="Account history pages">
      <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button type="button" disabled={!data.hasMore} onClick={()=>setPage(p=>p+1)}>Next</button>
    </nav>}</div>:
    <div className="account-empty"><AccountIcon name="history"/><h3>N/A</h3><p>No reports or correspondence for this account.</p></div>;
}

export function FeedbackView({showDisclaimer}:{showDisclaimer:()=>void}){
  const [message,setMessage]=useState("");
  const requestId=useRef("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState("");
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  async function send(e:FormEvent){
    e.preventDefault();if(busy || !message.trim())return;
    if(!requestId.current) requestId.current=crypto.randomUUID();
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/account/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:requestId.current,message:message.trim()})});
      const body=await r.json() as ApiError & {delivery?:string;emailDraft?:string};
      if(!r.ok)throw Error(body.error || "Feedback could not be submitted.");
      setResult(body.delivery==="emailed"?"Your feedback was emailed to the developer.":"Your feedback is in the developer inbox.");
      if(body.emailDraft?.startsWith("mailto:"))setDraft(body.emailDraft);
    }catch(err){setError(err instanceof Error?err.message:"Please try again.");}
    finally{setBusy(false);}
  }
  return result?<div className="account-empty" role="status"><AccountIcon name="feedback"/><h3>Feedback received</h3><p>{result}</p>{draft && <a href={draft}>Email a copy</a>}</div>:
    <form className="account-form" onSubmit={send}>
      <label htmlFor="feedback-message">Message to the developer</label>
      <textarea id="feedback-message" rows={5} required maxLength={500} value={message} onChange={e=>{setMessage(e.target.value);requestId.current="";}} placeholder="What worked well, or what could be better?"/>
      <div className="account-form-meta"><button type="button" onClick={showDisclaimer}>Read the disclaimer</button><span>{message.length} / 500</span></div>
      <p className="account-fine">Please leave out passwords and personal medical information.</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="account-primary" disabled={busy || !message.trim()}>{busy?"Submitting…":"Submit feedback"}</button>
    </form>;
}

export function DeleteView({id,signOut}:{id:string;signOut:string}){
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function remove(e:FormEvent){
    e.preventDefault();if(busy || confirmation!=="DELETE")return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/account/profile",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedUser:id,confirmation})});
      if(!r.ok){const data=await r.json() as ApiError;throw Error(data.error || "Deletion could not be completed.");}
      clearDeletedReaderData(id);window.location.assign(signOut);
    }catch(err){setError(err instanceof Error?err.message:"Please try again.");setBusy(false);}
  }
  return <form className="account-form" onSubmit={remove}>
    <p>Deleting your Neurotype profile removes your saved account playlists, favorites, preferences, and feedback. The developer receives a deletion record. A minimal audit record and records required for active restrictions are retained.</p>
    <p>Your Google or ChatGPT account stays available. This action signs you out of Neurotype.</p>
    <label htmlFor="confirm-delete">Type DELETE to confirm</label><input id="confirm-delete" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false}/>
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="account-destructive" disabled={busy || confirmation!=="DELETE"}>{busy?"Deleting…":"Permanently delete my reader account"}</button>
  </form>;
}
