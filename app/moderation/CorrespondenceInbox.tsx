import {useCallback,useEffect,useState} from "react";
type Receipt={id:string;subject:string;message:string|null;created:number;kind:"feedback"|"deletion";delivery:string};
export default function CorrespondenceInbox(){
  const [records,setRecords]=useState<Receipt[]>([]);
  const [notice,setNotice]=useState("Loading account messages…");
  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/moderation/correspondence",{cache:"no-store"});
      if(!response.ok)throw Error();
      const data=await response.json() as {records:Receipt[]};
      setRecords(data.records);setNotice(data.records.length?"":"No feedback or account closures.");
    }catch{setNotice("Account messages could not be loaded.");}
  },[]);
  useEffect(()=>{void load();},[load]);
  return <section><h2>Feedback and account closures</h2><button onClick={load}>Refresh messages</button>
    <p role="status">{notice}</p>{records.map(record=><div className="review-record" key={record.id}>
      <b>{record.kind==="deletion"?"Profile deleted":"Reader feedback"}</b>
      <small>{new Date(record.created).toLocaleString()} · Account …{record.subject.slice(-10)} · {record.delivery==="emailed"?"Email accepted":"In developer inbox"}</small>
      {record.message && <p>{record.message}</p>}</div>)}</section>;
}
