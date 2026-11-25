import {publicArticle} from "./articleUrl";
import ReaderDisclaimer from "./ReaderDisclaimer";
import {useEffect,useRef,useState} from "react";
import ResourceArtwork from "./ResourceArtwork";
import ReaderModal from "./ReaderModal";
import {featuredArticles,starters,suggestedQuestions,pickVisitQuestions,type Resource,type SearchAnswer} from "./resources";
import {screenResource} from "./discoverySafety";
import {safeContent} from "./moderation/policy";
import {stored,persist} from "./localState";
import "./discovery.css";

type SearchResponse={items?:Resource[];answer?:SearchAnswer|null;error?:string;code?:string};
function recentQuestions():string[]{
  try{return JSON.parse(stored("neurotype-questions")||"[]").filter((q:unknown)=>typeof q==="string" && safeContent(q)).slice(0,6);}catch{return [];}
}
function savedSources():Resource[]{
  try{return JSON.parse(stored("neurotype-resource-list")||"[]").map(screenResource).filter(Boolean);}catch{return [];}
}
function reportBlock(){window.location.assign("/appeal");}
const unsupported="This request is not supported.";
export default function Discovery({readInEditor}:{readInEditor:(url:string)=>void}){
  const [draft,setDraft]=useState("");
  const [query,setQuery]=useState("");
  const [context,setContext]=useState("");
  const [recent,setRecent]=useState<string[]>([]);
  const [questions,setQuestions]=useState(()=>suggestedQuestions.slice(0,3));
  const picked=useRef(false);
  const [selected,setSelected]=useState<Resource|null>(null);
  const [paragraphs,setParagraphs]=useState<string[]>([]);
  const [loadingArticle,setLoadingArticle]=useState(false);
  const [articleError,setArticleError]=useState("");
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [items,setItems]=useState<Resource[]>(starters);
  const [answer,setAnswer]=useState<SearchAnswer|null>(null);
  const [saved,setSaved]=useState<Resource[]>([]);
  const [listView,setListView]=useState(false);
  const [saveError,setSaveError]=useState("");
  const [error,setError]=useState("");
  const [status,setStatus]=useState("Loading articles and books…");
  const active=useRef<AbortController|null>(null);
  const searchInput=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(!picked.current){
      picked.current=true;
      let previous:string[]=[];
      try {const saved=JSON.parse(stored("neurotype-previous-suggestions")||"[]");if(Array.isArray(saved))previous=saved;}catch{/* First visit. */}
      const next=pickVisitQuestions(previous);
      setQuestions(next);persist("neurotype-previous-suggestions",JSON.stringify(next));
    }
    const sync=()=>{setRecent(recentQuestions());setSaved(savedSources());};
    sync();window.addEventListener("storage",sync);
    const controller=new AbortController();active.current=controller;
    fetch("/api/discover",{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw new Error();
      const data=await r.json() as SearchResponse;
      if(!controller.signal.aborted){setItems(data.items?.length?data.items:starters);setStatus("");}
    }).catch(()=>{if(!controller.signal.aborted)setStatus("Showing the starter shelf.");});
    return ()=>{active.current?.abort();window.removeEventListener("storage",sync);};
  },[]);
  useEffect(()=>{
    setParagraphs([]);setArticleError("");setLoadingArticle(false);
    if(!selected || selected.kind!=="Article" || !/^https:\/\/(en\.wikipedia\.org\/wiki\/|pmc\.ncbi\.nlm\.nih\.gov\/articles\/|www\.nimh\.nih\.gov\/health\/publications\/)/.test(selected.url))return;
    const controller=new AbortController();setLoadingArticle(true);
    fetch("/api/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:selected.title.slice(0,180),article:selected.url}),signal:controller.signal})
      .then(async r=>{if(!r.ok){if(r.status===403 && (await r.json() as SearchResponse).code==="blocked")reportBlock();throw new Error();}return r.json() as Promise<{paragraphs?:string[]}>;})
      .then(data=>{if(!controller.signal.aborted){
        const parts=Array.isArray(data.paragraphs)?data.paragraphs.filter((p:unknown)=>typeof p==="string" && safeContent(p)):[];
        setParagraphs(parts);if(!parts.length)setArticleError("The extended text is unavailable here. You can read it at the original source.");
      }}).catch(()=>{if(!controller.signal.aborted)setArticleError("The extended text could not load. Visit the original source to read on.");})
      .finally(()=>{if(!controller.signal.aborted)setLoadingArticle(false);});
    return ()=>controller.abort();
  },[selected]);
  function saveSource(item:Resource){
    const current=savedSources();
    const next=current.some(x=>x.url===item.url)?current.filter(x=>x.url!==item.url):[item,...current];
    if(persist("neurotype-resource-list",JSON.stringify(next))){setSaved(next);setSaveError("");}
    else setSaveError("This browser could not save the list.");
  }
  async function submit(value:string,scope=""){
    const term=value.trim();if(!term)return;
    active.current?.abort();
    const controller=new AbortController();active.current=controller;
    setDraft(term);setListView(false);setError("");setQuery("");setItems([]);setAnswer(null);setStatus("Finding an answer and related reading…");
    try{
      const response=await fetch("/api/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:term,context:scope}),signal:controller.signal});
      const data=await response.json() as SearchResponse;
      if(controller.signal.aborted)return;
      if(!response.ok){
        if(data.code==="blocked")reportBlock();
        setStatus("");setError(data.code==="unsupported"?unsupported:data.error || "Search is unavailable. Please try again.");return;
      }
      const results=(data.items || []).map(screenResource).filter((r):r is Resource=>!!r);
      setItems(results);setQuery(term);setAnswer(data.answer || null);setStatus(results.length?(!data.answer?"These sources may help. A sourced answer was unavailable.":""):"No matching sources. Try a more specific question about neurodivergence.");
      const next=[term,...recentQuestions().filter(q=>q!==term)].slice(0,6);
      persist("neurotype-questions",JSON.stringify(next));setRecent(next);
    }catch{if(!controller.signal.aborted){setStatus("");setError("Search could not connect. Please try again.");}}
  }
  function focusQuestion(subject:string){
    setSelected(null);setDraft("");setContext(subject.slice(0,180));setError("");
    requestAnimationFrame(()=>{searchInput.current?.focus();});
  }
  function grid(resources:Resource[]){
    return <div className="resource-grid">{resources.map(item=><button className="resource-card" key={item.url} onClick={()=>{setSelected(item);setSaveError("");}} aria-haspopup="dialog">
      <ResourceArtwork item={item}/><span className="resource-details"><small>{item.kind}</small><strong>{item.title}</strong><span>{item.source}</span><span className="card-excerpt">{item.summary}</span></span>
    </button>)}</div>;
  }
  return <section className="discovery outlined-section" aria-labelledby="learn-heading">
    <h2 id="learn-heading">Learn more about neurodivergence</h2>
    <form onSubmit={e=>{e.preventDefault();submit(draft,context);}}>
      <label htmlFor="resource-query">{context?"Ask a follow-up":"Find articles and books"}</label>
      {context && <div className="follow-context">About {context}<button type="button" aria-label="Remove question context" onClick={()=>setContext("")}>×</button></div>}
      <div className="query-row"><input ref={searchInput} id="resource-query" type="search" maxLength={180} value={draft} placeholder="Ask a question about neurodivergence" aria-invalid={error===unsupported || undefined} aria-describedby={error?"discovery-error":undefined} onChange={e=>{setDraft(e.target.value);if(error)setError("");}}/><button disabled={!draft.trim()}>Search</button></div>
      {error && <p id="discovery-error" className="discovery-error" role="alert">{error}</p>}
    </form>
    <div className="question-options">{questions.map(q=><button key={q} onClick={()=>{setContext("");submit(q);}}>{q}</button>)}</div>
    {recent.length>0 && <details><summary>Recent questions</summary><div className="question-options">{recent.map(q=><button key={q} onClick={()=>{setContext("");submit(q);}}>{q}</button>)}</div></details>}
    <div className="library-tabs shelf-tabs"><button aria-pressed={!listView} onClick={()=>setListView(false)}>Search results</button><button aria-pressed={listView} onClick={()=>setListView(true)}>My reading list · {saved.length}</button></div>
    {!listView && answer && <article className="discovery-answer" aria-label={answer.kind}>
      <small>{answer.kind}</small><h3>{query}</h3><p>{answer.text}</p><ul>{answer.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
      <button className="discovery-link" onClick={()=>focusQuestion(query)}>Ask a follow-up</button>
    </article>}
    <p className="discovery-fineprint">For learning. Health questions belong with a qualified clinician. <button className="discovery-link" onClick={()=>setNoticeOpen(true)}>About these answers</button></p>
    <div className="results-head"><h3>{listView?"My reading list":query?"Related reading":"Explore the shelf"}</h3>
      {!error && <a href={"https://www.google.com/search?safe=active&q="+encodeURIComponent("neurodivergence "+query)} target="_blank" rel="noreferrer">Search on Google ↗</a>}</div>
    <p className="search-status" role="status">{listView?(saved.length?"":"Save a title from its preview to find it here."):status}</p>
    {grid(listView?saved:items)}
    <section className="featured-articles" aria-labelledby="featured-heading"><h3 id="featured-heading">Featured articles</h3>{grid(featuredArticles)}</section>
    {noticeOpen && <ReaderModal title="About these answers" close={()=>setNoticeOpen(false)}><ReaderDisclaimer/></ReaderModal>}
    {selected && <ReaderModal title={selected.title} close={()=>setSelected(null)}>
      <article className="source-preview"><ResourceArtwork key={selected.url} item={selected}/><div><b>{selected.source}</b><p>{selected.summary}</p>
      {selected.kind==="Article" && publicArticle(selected.url) && <button className="article-editor-link" type="button" onClick={()=>{
        setSelected(null);readInEditor(selected.url);
      }}>Read in text editor</button>}
      {loadingArticle && <small role="status">Loading article text…</small>}{articleError && <small role="status">{articleError}</small>}
      {paragraphs.length>0 && <div className="article-body"><h3>From the article</h3>{paragraphs.slice(0,2).map((p,i)=><p key={i}>{p}</p>)}
        {paragraphs.length>2 && <details><summary>Continue reading</summary>{paragraphs.slice(2).map((p,i)=><p key={i}>{p}</p>)}</details>}
        <small>Excerpt from <a href={selected.url} target="_blank" rel="noreferrer">{selected.title}</a>, by {selected.source}. Sections abridged. {selected.source==="National Institute of Mental Health"?"Public-domain text.":<a href={selected.source==="Wikipedia contributors"?"https://creativecommons.org/licenses/by-sa/4.0/":"https://creativecommons.org/licenses/by/4.0/"} target="_blank" rel="noreferrer">Reuse license</a>}</small></div>}
      {selected.attribution && <small>{selected.attribution} {selected.source==="Wikipedia contributors" && <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">License</a>}</small>}
      <p><a href={selected.url} target="_blank" rel="noreferrer">Read at the original site ↗</a>{selected.imageCredit && <> · <a href={selected.imageCredit} target="_blank" rel="noreferrer">Image credits</a></>}</p>
      <div className="preview-actions"><button onClick={()=>saveSource(selected)}>{saved.some(item=>item.url===selected.url)?"Remove from reading list":"Save to reading list"}</button>
        <button onClick={()=>{const subject=selected.title;setSelected(null);setContext("");submit("Find similar articles",subject);}}>Find similar articles</button>
        <button onClick={()=>focusQuestion(selected.title)}>Ask a follow-up</button></div><small role="status">{saveError}</small></div></article>
    </ReaderModal>}
  </section>;
}
