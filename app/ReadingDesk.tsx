import { useEffect, useState } from "react";
import ReaderModal from "./ReaderModal";
import {history, rememberRead} from "./localState";
import { summarize } from "./readingTools";

const prefix = "neurotype-demo-read:";
type Read = { id: string; text: string; created: number };

function savedReads(): Read[] {
  const reads: Read[] = [];
  for (const id of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
    try {
      const item = JSON.parse(localStorage.getItem(id) ?? "null");
      if (typeof item?.text === "string" && typeof item.created === "number") reads.push({ ...item, id });
    } catch { continue; }
  }
  return reads.sort((a, b) => b.created - a.created);
}

export default function ReadingDesk({ text, open }: { text: string; open: (text: string) => void }) {
  const [reads, setReads] = useState<Read[]>([]);
  const [recent, setRecent] = useState<ReturnType<typeof history>>([]);
  const [tab, setTab] = useState<"saved"|"history">("saved");
  const [library, setLibrary] = useState(false);
  const [notice, setNotice] = useState("");
  const [brief, setBrief] = useState<{ source: string; result: ReturnType<typeof summarize> } | null>(null);
  useEffect(() => {
    const refresh = () => { try { setReads(savedReads()); setRecent(history()); } catch { setNotice("Storage is unavailable in this browser."); } };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("reading-history", refresh);
    return () => {window.removeEventListener("storage", refresh);window.removeEventListener("reading-history",refresh);};
  }, []);
  const save = () => {
    try {
      const current = savedReads();
      if (current.some(item => item.text === text)) { setNotice("This read is already in your library."); return; }
      localStorage.setItem(prefix + crypto.randomUUID(), JSON.stringify({ text, created: Date.now() }));
      setReads(savedReads());
      rememberRead(text);setTab("saved");setLibrary(true);setNotice("Saved to your reading library.");
    } catch { setNotice("Couldn’t save this read. Browser storage may be unavailable or full."); }
  };
  const result = brief?.source === text ? brief.result : null;
  return (
    <section id="saved-reads" className="reading-desk" aria-label="Summary and saved reads">
      <div className="desk-actions">
        <button className="desk-primary" disabled={!text.trim()} onClick={() => {rememberRead(text);setBrief({ source: text, result: summarize(text) });}}>Summarize</button>
        <button disabled={!text.trim()} onClick={save}>Save read</button>
        <span role="status">{notice}</span>
      </div>
      {result && <article className="brief-card" aria-label="Text summary">
        <h2>At a glance</h2>
        <p>Key statements from your text · {result.statements.join(" ").split(/\s+/).length} of {text.trim().split(/\s+/).length} words</p>
        <ul>{result.statements.map(sentence => <li key={sentence}>{sentence}</li>)}</ul>
        {result.topics.length > 0 && <p><b>Topics</b> · {result.topics.join(" · ")}</p>}
      </article>}
      <button className="library-launch" aria-haspopup="dialog" onClick={()=>{setTab(reads.length || !recent.length ? "saved" : "history");setLibrary(true);}}>Reading library · {reads.length} saved <span aria-hidden="true">⛶</span></button>
      {library && <ReaderModal title="Reading library" close={()=>setLibrary(false)}>
        <div className="library-tabs">{(["saved","history"] as const).map(view=><button key={view} aria-pressed={view===tab} onClick={()=>setTab(view)}>{view==="saved"?"Saved reads":"Reading history"} · {view==="saved"?reads.length:recent.length}</button>)}</div>
        <div className="library-items" key={tab}>
          {(tab==="saved"?reads:recent).map(item=><details key={"id" in item?item.id:item.date} name="library-entry"><summary>{item.text.trim().split(/\n/)[0].slice(0,72)}</summary>
            <p>{item.text}</p><button onClick={()=>{setLibrary(false);open(item.text);rememberRead(item.text);setBrief(null);}}>Open in reader</button>
          </details>)}
          {(tab==="saved"?reads:recent).length===0 && <p>{tab==="saved"?"Use Save read to keep a passage here.":"Passages you edit, summarize, or reopen appear here."}</p>}
        </div>
      </ReaderModal>}
    </section>
  );
}
