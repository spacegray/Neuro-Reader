import {useEffect,useState,type ReactNode} from "react";
import {approvedImages} from "./discoverySafety";
import {artworkSignature,imageList,sourceArtworkKey} from "./resourceImages";
import type {Resource} from "./resources";

// First match the subject of the title, then try its description for ambiguous titles.
const topics=[
  ["masking",/masking|camouflag/i],
  ["burnout",/burn.?out|fatigue|exhaustion|overwhelm/i],
  ["advocacy",/advoca|rights|accessib|inclusion|accommodat/i],
  ["research",/female|women|study|studies|research|experiment|analysis|prevalence/i],
  ["reading",/dyslex|reading|literacy|spell|decod/i],
  ["sensory",/sensory|noise|sounds?|rhythm/i],
  ["attention",/adhd|attention|organiz|routine|planning/i],
  ["diversity",/neurodiver|autis|divergent|neurotribes/i],
] as const;
type Motif=typeof topics[number][0]|"book"|"article";
function motif(item:Resource):Motif {
  return topics.find(([,pattern])=>pattern.test(item.title))?.[0] ||
    topics.find(([,pattern])=>pattern.test(item.summary))?.[0] || (item.kind==="Book"?"book":"article");
}
const drawings:Record<Motif,ReactNode>={
  masking:<><path d="M14 20l17-4 3 14c1 7-2 12-6 15-6-1-11-4-12-11z"/><path className="motif-fill" d="M27 25l18 4-3 14c-2 6-7 10-12 11-4-4-6-10-5-16z"/><path d="m29 34 3 1m5 1 3 1m-11 6q4 3 8 0"/></>,
  burnout:<><path className="motif-fill" d="M17 40a15 15 0 0 1 30 0z"/><path d="M11 41h42M17 47h30M24 53h16M32 13v5m-16 1 3 4m29-4-3 4m-35 6 5 2m39-2-5 2"/></>,
  advocacy:<><path className="motif-fill" d="m13 28 12-1 19-11v33L25 38l-12-1z"/><path d="m19 38 4 13h6l-4-13m1-11v11m25-13 4-3m-4 11h5m-6 7 4 3"/></>,
  research:<><path className="motif-fill" d="M12 18h31v31H12z"/><path d="M18 41v-7m6 7V30m6 11v-5"/><circle cx="39" cy="27" r="9"/><path d="m46 34 8 9M17 23h7"/></>,
  reading:<><path className="motif-fill" d="M10 20q12-4 22 2 9-6 22-2v28q-12-3-22 2-10-5-22-2z"/><path d="M32 22v28m-16-23 9 1m-9 5 9 1m13-6 9-1m-9 7 9-1"/></>,
  sensory:<><path d="M11 32h3m4-7v14m7-22v30m7-35v40m7-33v26m7-19v12m4-6h3"/></>,
  attention:<><circle className="motif-fill" cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="10"/><circle className="motif-spot" cx="32" cy="32" r="3"/><path d="M32 10v7m0 30v7m15-22h7m-44 0h7"/></>,
  diversity:<><path className="motif-fill" d="M9 32c0-10 11-16 20-7l8 9c7 9 18 8 18-2s-11-14-18-5L26 39C18 47 9 40 9 32z"/></>,
  book:<><path className="motif-fill" d="M19 13h29v37H21q-6 0-6-6V18q0-5 4-5z"/><path d="M19 44h29m-27-31v31m6-22h14m-14 6h10"/></>,
  article:<><path className="motif-fill" d="M15 13h25l9 9v29H15z"/><path d="M40 13v10h9m-27 5h15m-15 7h20m-20 7h15"/></>,
};
export default function ResourceArtwork({item}:{item:Resource}){
  const [failed,setFailed]=useState<string[]>([]);
  const [resolved,setResolved]=useState<{source:string;images:string[]}|null>(null);
  const known=imageList(item.image,...item.imageAlternates || []);
  const retry=resolved?.source===item.url?resolved.images:[];
  const image=[...known,...retry].find(candidate=>!failed.includes(candidate));
  const needsLookup=!image && resolved?.source!==item.url;
  useEffect(()=>{
    if(!needsLookup || !sourceArtworkKey(item.url))return;
    const controller=new AbortController();
    fetch("/api/discover/artwork?source="+encodeURIComponent(item.url),{signal:controller.signal})
      .then(async response=>response.ok?await response.json() as {images?:string[]}:{}).then(data=>{
        if(!controller.signal.aborted)setResolved({source:item.url,images:approvedImages(...data.images || [])});
      }).catch(()=>{if(!controller.signal.aborted)setResolved({source:item.url,images:[]});});
    return ()=>controller.abort();
  },[item.url,needsLookup]);
  const topic=image?undefined:motif(item);
  const signature=artworkSignature(item);
  const dots=[0,1,2,3,4,5,6].filter(i=>signature & (1<<i));
  const failedCandidate=(src:string)=>setFailed(previous=>previous.includes(src)?previous:[...previous,src]);
  return <span className={"resource-art "+(item.kind==="Book"?"book":"article")} data-motif={topic}
    data-variant={topic?signature%4:undefined} aria-hidden="true">
    {image?<img key={image} loading="lazy" decoding="async" alt="" src={image} onError={()=>failedCandidate(image)}
      onLoad={e=>{if(e.currentTarget.naturalWidth<5 || e.currentTarget.naturalHeight<5)failedCandidate(image);}}/>:
      <svg viewBox="0 0 64 64" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {drawings[topic!]}
        <g className="motif-imprint" stroke="none" fill="currentColor">{dots.map(i=><circle key={i} cx={12+i*6} cy={57+((signature>>>(i+8))&3)} r={1+((signature>>>(i+17))&1)*.45}/>)}</g>
      </svg>}
  </span>;
}
