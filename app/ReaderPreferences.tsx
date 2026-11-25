import {useReaderPreferences} from "./preferencesContext";
import {topColors,type GenreChoice} from "./readerPreferenceModel";
import {filters} from "./musicLibrary";
import {sampleCategories,sampleShelf} from "./readingSamples";
import {profiles} from "./readerChoices";
import "./readerPreferences.css";

export default function ReaderPreferences(){
  const {profile:p,ready,notice,apply,retry}=useReaderPreferences();
  const swatches=topColors(p),palette=profiles.find(v=>v.id===p.colors.palette);
  const genres=filters.genre.filter(g=>p.choices[g]==="prefer" || (p.choices[g]!=="avoid" && p.genres[g]>0))
    .sort((a,b)=>Number(p.choices[b]==="prefer")-Number(p.choices[a]==="prefer") || (p.genres[b]||0)-(p.genres[a]||0));
  if(!ready)return <p role="status">Loading your preferences…</p>;
  return <div className="reader-pref-body">
    <p>During your first 24 hours, palette choices and music selections shape your favorites. Save a color change with <b>Set as default</b> in the reader toolbar.</p>
    <dl><div><dt>Default colors</dt><dd>{palette?.name} · {p.colors.fill==="full"?"Full":"Soft"} fill · {p.colors.ink} words · {p.colors.mode} appearance</dd></div>
      <div><dt>Top three colors</dt><dd>{swatches.length?swatches.map(s=><span className="reader-pref-swatch" key={s.id}><i style={{background:s.swatch}}/>{s.name}</span>):"Choose a palette in the toolbar to start."}</dd></div>
      <div><dt>Favorite genres</dt><dd>{genres.join(", ") || "Choose a genre or play a track to start."}</dd></div>
      <div><dt>Disliked genres</dt><dd>{filters.genre.filter(g=>p.choices[g]==="avoid").join(", ") || "None"}</dd></div></dl>
    <div className="reader-pref-fields">
      <label>Focus strength<select value={p.strength} onChange={e=>apply({type:"strength",value:+e.target.value})}>{[25,30,35,40,45,50,55,60,65,70,75].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>
      <label>Text size<select value={p.size} onChange={e=>apply({type:"size",value:+e.target.value})}>{[18,21,25].map(n=><option key={n} value={n}>{n} px</option>)}</select></label>
      <label>Sample category<select value={p.category} onChange={e=>apply({type:"sample",category:e.target.value,topic:""})}>
        <option value="">All categories</option>{sampleCategories.map(c=><option key={c}>{c}</option>)}</select></label>
      {p.category && <label>Sample topic<select value={p.topic} onChange={e=>apply({type:"sample",category:p.category,topic:e.target.value})}>
        <option value="">All topics</option>{[...new Set(sampleShelf.filter(s=>s.category===p.category).map(s=>s.topic))].map(t=><option key={t}>{t}</option>)}</select></label>}
    </div>
    <details><summary>Choose music genres</summary><div className="reader-pref-fields">
      {filters.genre.map(g=><label key={g}>{g}<select value={p.choices[g]||"auto"} onChange={e=>apply({type:"genre",genre:g,choice:e.target.value as GenreChoice})}>
        <option value="auto">Automatic</option><option value="prefer">Prefer</option><option value="avoid">Dislike</option></select></label>)}
    </div></details>
    {notice && <p role="status">{notice} <button type="button" onClick={retry}>Retry</button></p>}
  </div>;
}
