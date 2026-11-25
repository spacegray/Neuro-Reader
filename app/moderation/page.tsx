"use client";
import {useCallback,useEffect,useState} from "react";
import "./review.css";
import CorrespondenceInbox from "./CorrespondenceInbox";
type Report={id:string;subject:string;created:number;reason:string;confidence:number;strike:number;attempts:number};
type Block={subject:string;blocked_at:number};
type Appeal={id:string;block_subject:string;subject:string;message:string;documentation:string;created:number;status:string};
type Inbox={reports:Report[];blocks:Block[];appeals:Appeal[]};
const name=(s:string)=>s==="guest"?"Anonymous visitors":"Account …"+s.slice(-10);
const date=(n:number)=>new Date(n).toLocaleString();
export default function Review(){
  const [data,setData]=useState<Inbox|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try {const r=await fetch("/api/moderation/review",{cache:"no-store"});if(r.ok){setData(await r.json() as Inbox);return;}const d=await r.json() as {error?:string};setData(null);setNotice(d.error || "The inbox could not be loaded.");}catch{setNotice("The inbox could not be loaded.");}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function decide(action:"release"|"decline",subject:string,appeal?:string){
    if(busy)return;setBusy(true);
    try {const r=await fetch("/api/moderation/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,subject,appeal})});
      if(!r.ok)throw Error();setNotice(action==="release"?"Access restored.":"Appeal reviewed.");await load();
    }catch{setNotice("The review could not be saved.");}finally{setBusy(false);}
  }
  return <main className="review-page"><article><a href="/">Neurotype Reader</a><h1>Moderation inbox</h1><p role="status">{notice}</p>
    {data && <><p>{data.appeals.filter(a=>a.status==="pending").length} pending appeals · {data.blocks.length} active restrictions · {data.reports.length} recent reports shown</p><button onClick={load}>Refresh reports</button>
    <section><h2>Appeals</h2>{!data.appeals.length && <p>No appeals.</p>}
    {data.appeals.map(a=><div className="review-record" key={a.id}><b>{name(a.subject)}</b><small>{date(a.created)} · {a.status}</small>
      <p>{a.message}</p>{a.documentation && <blockquote>{a.documentation}</blockquote>}
      {a.status==="pending" && <div><button disabled={busy} onClick={()=>decide("release",a.block_subject)}>Restore access</button>
        <button disabled={busy} onClick={()=>decide("decline",a.block_subject,a.id)}>Keep restriction</button></div>}</div>)}</section>
    <section><h2>Urgent account restrictions</h2>{!data.blocks.length && <p>No active restrictions.</p>}
    {data.blocks.map(b=><div className="review-record" key={b.subject}><b>{name(b.subject)}</b><small>{date(b.blocked_at)}</small>
      <button disabled={busy} onClick={()=>decide("release",b.subject)}>Restore access</button></div>)}</section>
    <section><h2>Recent incident reports</h2><p>Confidence describes the matched rule. Urgent restrictions appear above for administrator review.</p>
      {!data.reports.length && <p>No reports.</p>}{data.reports.map(r=><div className="review-record" key={r.id}>
        <b>{r.reason}</b><span>{name(r.subject)} · {date(r.created)}</span>
        <small>Rule confidence {r.confidence}/100 · {r.reason.startsWith("Urgent")?"Restriction issued":r.strike?"Counts toward a restriction":"Filter only"} · {r.attempts} {r.attempts===1?"attempt":"attempts"}</small></div>)}</section>
    <CorrespondenceInbox/></>}</article></main>;
}
