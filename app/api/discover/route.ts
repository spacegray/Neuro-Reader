import {guideAnswer,relatedGuides,shelfFor,starters,type Resource,type SearchAnswer} from "../../resources";
import {coverImage,imageList,openLibraryImages,withImages} from "../../resourceImages";
import {screenResource} from "../../discoverySafety";
import {boundedJson,guardSearch,principal} from "../../moderation/guard";

import {googleAnswer} from "./answers";
import {articleExcerpt} from "./article";

export const dynamic = "force-dynamic";

function plain(text:unknown) {
  return typeof text==="string" ? text.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim() : "";
}
function secure(value:unknown) {
  if(typeof value!=="string") return undefined;
  try {const u=new URL(value);if(u.protocol==="http:")u.protocol="https:";return u.protocol==="https:" ? u.href : undefined;} catch {return undefined;}
}
async function get(endpoint:string, params:Record<string,string>) {
  const url=new URL(endpoint);
  url.search=new URLSearchParams(params).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(5500),headers:{"User-Agent":"NeurotypeReader/1.0 (https://neurotype-reader.urbansafariwear.chatgpt.site/)"}});
  if(!response.ok) throw new Error("Provider unavailable");
  return response.json();
}
type WikiPage={title:string;fullurl?:string;extract?:string;index:number;thumbnail?:{source?:string};original?:{source?:string};pageimage?:string};
async function articles(query:string):Promise<Resource[]> {
  const data=await get("https://en.wikipedia.org/w/api.php",{action:"query",generator:"search",gsrsearch:query,gsrlimit:"4",gsrnamespace:"0",prop:"extracts|pageimages|info",exintro:"1",explaintext:"1",exchars:"1200",exlimit:"4",piprop:"thumbnail|original|name",pithumbsize:"330",pilimit:"4",pilicense:"free",inprop:"url",format:"json",formatversion:"2"});
  if((data as {error?:unknown}).error) throw new Error("Article lookup unavailable");
  return ((data as {query?:{pages?:WikiPage[]}}).query?.pages || []).sort((a,b)=>a.index-b.index).flatMap(page=>{
    const url=secure(page.fullurl);
    if(!url || !page.extract) return [];
    return [{kind:"Article",title:page.title,source:"Wikipedia contributors",url,summary:page.extract,...withImages(imageList(secure(page.thumbnail?.source),secure(page.original?.source))),imageCredit:page.pageimage?"https://en.wikipedia.org/wiki/File:"+encodeURIComponent(page.pageimage):undefined,attribution:"Wikipedia introduction excerpt · CC BY-SA 4.0"}];
  });
}
type Volume={id:string;volumeInfo:{maturityRating?:string;title:string;authors?:string[];publisher?:string;description?:string;infoLink?:string;industryIdentifiers?:{identifier?:string}[];imageLinks?:{thumbnail?:string;smallThumbnail?:string}}};
async function books(query:string):Promise<Resource[]> {
  const data=await get("https://www.googleapis.com/books/v1/volumes",{q:query,maxResults:"4",printType:"books",langRestrict:"en"});
  return ((data as {items?:Volume[]}).items || []).filter(v=>v.volumeInfo?.maturityRating==="NOT_MATURE").map(({id,volumeInfo:v})=>({
    kind:"Book",title:v.title,source:[v.authors?.slice(0,2).join(", "),v.publisher || "Google Books"].filter(Boolean).join(" · "),
    url:secure(v.infoLink)||"https://books.google.com/books?id="+encodeURIComponent(id),
    summary:plain(v.description).slice(0,750) || "Visit Google Books for publication details and preview availability.",
    ...withImages(imageList(secure(v.imageLinks?.thumbnail),secure(v.imageLinks?.smallThumbnail),...(v.industryIdentifiers || []).map(i=>coverImage("isbn",i.identifier)))),attribution:"Book information and cover via Google Books",
  }));
}
type LibraryBook={key:string;title:string;author_name?:string[];cover_i?:number;cover_edition_key?:string;isbn?:string[];first_publish_year?:number;subject?:string[]};
async function libraryBooks(query:string):Promise<Resource[]> {
  const data=await get("https://openlibrary.org/search.json",{q:query,limit:"4",fields:"key,title,author_name,cover_i,cover_edition_key,isbn,first_publish_year,subject"});
  return ((data as {docs?:LibraryBook[]}).docs || []).filter(book=>/^\/works\/OL\d+W$/.test(book.key)).map(book=>({
    kind:"Book",title:book.title,source:(book.author_name||["Open Library"]).slice(0,3).join(", "),url:"https://openlibrary.org"+book.key,...withImages(openLibraryImages(book)),

    summary:[book.first_publish_year?"First published in "+book.first_publish_year+".":"",book.subject?.length?"Catalog subjects include "+book.subject.slice(0,5).join(", ")+".":""].filter(Boolean).join(" ") || "Explore the editions of this book in the Open Library catalog.",
    attribution:"Catalog information and cover via Open Library",
  }));
}
function failure(message:string,status:number,code="unsupported"){
  return Response.json({error:message,code},{status,headers:{"Cache-Control":"private, no-store"}});
}
async function discover(term:string,context:string,submitted:boolean,subject?:string){
  const searchText=[term,context].filter(Boolean).join(" ");
  const keywords=searchText.replace(/[^\p{L}\p{N}\s-]/gu," ").split(/\s+/).filter(word=>word && !/^(what|which|are|is|some|how|can|do|does|why|a|an|the|for|about|recommend|explain|help|with|more|similar|books|articles|i|find|read|me)$/i.test(word)).slice(0,10).join(" ");
  const query=keywords || "neurodiversity";
  const scoped=/neurodiver|autis|adhd|dyslex/i.test(query)?query:"neurodiversity "+query;
  const results=await Promise.allSettled([articles(scoped),books(scoped).catch(()=>libraryBooks(scoped))]);
  const live=results.flatMap(r=>r.status==="fulfilled"?r.value:[]).map(screenResource).filter((r):r is Resource=>!!r);
  const guides=relatedGuides(searchText);
  const similar=term==="Find similar articles" && Boolean(context);
  const candidates=[...(submitted?guides:starters),...live,...(similar?shelfFor(context):[])];
  const items=[...new Map(candidates.map(r=>[r.url,r])).values()].filter(r=>!similar || (r.kind==="Article" && r.title.toLowerCase()!==context.toLowerCase()));
  const question=context?term+" (About: "+context+")":term;
  let answer:SearchAnswer|null=null;
  if(submitted && !similar){
    answer=(subject?await googleAnswer(question,items,subject):null) || guideAnswer(term);
    if(!answer){
      const priorSource=context?guideAnswer(context)?.sources[0]?.url:null;
      const previous=context?items.find(r=>r.kind==="Article" && (r.title.toLowerCase()===context.toLowerCase() || r.url===priorSource)):undefined;
      const source=previous || relatedGuides(term)[0] || guides[0] || live.find(r=>r.kind==="Article");
      if(source)answer={kind:"Source notes",text:source.summary.slice(0,900),sources:[{title:source.title,url:source.url}]};
    }
  }
  return Response.json({items,answer,unavailable:results.filter(r=>r.status==="rejected").length},{headers:{"Cache-Control":"private, no-store"}});
}
export async function GET(request:Request) {
  const q=new URL(request.url).searchParams.get("q");
  if(q && q!=="neurodiversity")return failure("Use the search form to ask a question.",405);
  return discover("neurodiversity","",false);
}
export async function POST(request:Request){
  const data=await boundedJson(request,4096);
  if(!data || typeof data.q!=="string" || (data.context!==undefined && typeof data.context!=="string"))return failure("This request is not supported.",400);
  const denied=await guardSearch(request,data.q);if(denied)return denied;
  const context=typeof data.context==="string"?data.context:"";
  if(context){const deniedContext=await guardSearch(request,context);if(deniedContext)return deniedContext;}
  if(data.article!==undefined){
    let paragraphs:string[]=[];try{paragraphs=await articleExcerpt(data.article);}catch{/* Publisher preview is still available. */}
    return Response.json({paragraphs},{headers:{"Cache-Control":"private, no-store"}});
  }
  return discover(data.q.trim(),context.trim(),true,(await principal(request))?.subject);
}
