import {allowedUrl,articleHosts} from "../../discoverySafety";
import {safeContent} from "../../moderation/policy";

export async function articleExcerpt(input:unknown) {
  const url=allowedUrl(input,articleHosts);
  if(!url)return [];
  const {hostname,pathname}=new URL(url);
  let text="";
  if(hostname==="en.wikipedia.org" && /^\/wiki\/[^:?#]+$/.test(pathname)){
    const title=decodeURIComponent(pathname.slice(6)).replaceAll("_"," ");
    if(!safeContent(title) || title.length>200)return [];
    const endpoint=new URL("https://en.wikipedia.org/w/api.php");
    endpoint.search=new URLSearchParams({action:"query",titles:title,prop:"extracts",explaintext:"1",exsectionformat:"plain",format:"json",formatversion:"2"}).toString();
    const r=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});
    if(!r.ok)return [];
    const data=await r.json() as {query?:{pages?:{extract?:string}[]}};
    text=(data.query?.pages?.[0]?.extract || "").split(/\n(?:References|See also|Further reading)\s*\n/i)[0];
  }else if(hostname==="www.nimh.nih.gov" && ["/health/publications/adhd-what-you-need-to-know","/health/publications/attention-deficit-hyperactivity-disorder-what-you-need-to-know"].includes(pathname)){
    const r=await fetch("https://www.nimh.nih.gov"+pathname,{redirect:"error",signal:AbortSignal.timeout(5000)});if(!r.ok)return [];
    const html=await r.text();
    if(!/in the public domain/i.test(html))return [];
    const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
    const content=main.split(/<h2\b[^>]*>\s*(?:Reprints|For more information|Where can I find)/i)[0];
    text=[...content.matchAll(/<(p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m=>m[2].replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#039;/g,"’").replace(/\s+/g," ").trim()).join("\n\n");
  }else if(hostname==="pmc.ncbi.nlm.nih.gov" && /^\/articles\/(PMC7422602|PMC8870220)\/$/.test(pathname)){
    const id=pathname.split("/")[2];
    const r=await fetch("https://www.ebi.ac.uk/europepmc/webservices/rest/"+id+"/fullTextXML",{signal:AbortSignal.timeout(5000)});
    if(!r.ok)return [];
    const xml=await r.text();
    if(!/<license\b[^>]*creativecommons\.org\/licenses\/by\/4\.0/i.test(xml))return [];
    const body=xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "";
    text=[...body.replace(/<(fig|table-wrap|supplementary-material)\b[^>]*>[\s\S]*?<\/\1>/gi,"").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>m[1].replace(/<[^>]+>/g,"").replaceAll("&amp;","&")).join("\n\n");
  }
  return text.slice(0,55000).split(/\n+/).map(p=>p.trim()).filter(p=>p.length>55 && p.length<5200 && safeContent(p)).slice(0,65);
}
