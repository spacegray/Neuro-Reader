import {useEffect,useImperativeHandle,useRef,useState,type Ref} from "react";
type Passage={title:string;text:string;url:string;truncated:boolean};
export type ReadLinkHandle={openArticle:(url:string)=>void};
export default function ReadLink({apply,hasDraft,ref}:{apply:(text:string)=>void;hasDraft:boolean;ref:Ref<ReadLinkHandle>}){
  const [url,setUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [preview,setPreview]=useState<Passage|null>(null);
  const [receipt,setReceipt]=useState<Pick<Passage,"title"|"url">|null>(null);
  const request=useRef<AbortController|null>(null);
  const panel=useRef<HTMLDetailsElement>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  function reset(){
    request.current?.abort();setBusy(false);setPreview(null);setError("");setReceipt(null);
  }
  const input=useRef<HTMLInputElement>(null);
  useImperativeHandle(ref,()=>({
    openArticle(source){
      if(!panel.current)return;
      panel.current.open=true;
      setUrl(source);
      input.current?.focus({preventScroll:true});
      panel.current.scrollIntoView({block:"center"});
      void load(source);
    }
  }));
  async function load(source:string){
    reset();
    const controller=new AbortController();request.current=controller;setBusy(true);
    try{
      const res=await fetch("/api/read-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:source.trim()}),signal:controller.signal});
      const data=await res.json() as Partial<Passage> & {error?:string};
      if(controller.signal.aborted)return;
      if(!res.ok){setError(data.error || "Couldn’t load the article. Paste your passage instead.");return;}
      if(typeof data.text!=="string" || !data.text || typeof data.title!=="string" || typeof data.url!=="string")throw Error("Invalid preview");
      setPreview({text:data.text,title:data.title,url:data.url,truncated:data.truncated===true});
    }catch{if(!controller.signal.aborted)setError("The connection failed. Try again or paste a passage.");}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="read-link">
    <details ref={panel} onToggle={e=>{if(!e.currentTarget.open && request.current){request.current.abort();setBusy(false);}}}>
      <summary>Read from a link</summary>
      <form onSubmit={e=>{e.preventDefault();void load(url);}}><label>Article URL<input ref={input} type="url" required maxLength={2048} placeholder="https://…" value={url} onChange={e=>{reset();setUrl(e.target.value);}}/></label>
        <button type="submit" disabled={busy || !url.trim()}>{busy?"Loading article…":"Preview article"}</button></form>
      <p className="link-hosts">Supports TechPP, English Wikipedia, PubMed abstracts, PMC, NIMH, CDC, NHS and MedlinePlus. For other sites, paste a passage.</p>
      {error && <p role="alert">{error}</p>}
      {preview && <div className="link-preview"><a href={preview.url} target="_blank" rel="noreferrer">{preview.title}</a>
        <p>{preview.text.slice(0,260)}{preview.text.length>260?"…":""}</p>
        <span>{preview.text.split(/\s+/).length.toLocaleString()} words{preview.truncated?" · First part of article":""}</span>
        <button type="button" onClick={()=>{apply(preview.text);setReceipt({title:preview.title,url:preview.url});setPreview(null);if(panel.current)panel.current.open=false;}}>{hasDraft?"Replace editor text":"Open in editor"}</button></div>}
    </details>
    <span className="link-receipt" role="status">{receipt?<>Imported from <a href={receipt.url} target="_blank" rel="noreferrer">{receipt.title}</a></>:(busy?"Loading article…":preview?"Article preview ready.":"")}</span>
  </div>;
}
