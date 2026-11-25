import {starters,featuredArticles,type Resource} from "./resources";
import {imageList,withImages} from "./resourceImages";
import {safeContent} from "./moderation/policy";

export const articleHosts=["en.wikipedia.org","www.health.harvard.edu","www.harvardhealth.org","www.nimh.nih.gov","pmc.ncbi.nlm.nih.gov","pubmed.ncbi.nlm.nih.gov","dyslexiaida.org","health.clevelandclinic.org","www.autism.org.uk","www.cdc.gov","www.nhs.uk","medlineplus.gov"];
const bookHosts=["books.google.com","openlibrary.org","www.nnlm.gov","penguinrandomhousehighereducation.com"];
const imageHosts=["content.health.harvard.edu","content.harvardhealth.org","d2y7ufl8l8ugun.cloudfront.net","s4.chorus-mk.thirdlight.com","upload.wikimedia.org","www.google.com","books.google.com","books.googleusercontent.com","covers.openlibrary.org","images.penguinrandomhouse.com"];
export function allowedUrl(raw:unknown,hosts:string[]){
  if(typeof raw!=="string")return undefined;
  try{
    const url=new URL(raw);
    if(url.protocol==="http:")url.protocol="https:";
    if(url.protocol!=="https:" || url.username || url.password || url.port || !hosts.includes(url.hostname))return undefined;
    if(!safeContent(decodeURIComponent(url.pathname)))return undefined;
    return url.href;
  }catch{return undefined;}
}
export function approvedImages(...urls:(string|undefined)[]) {
  return imageList(...urls.map(url=>{
    if(url==="/resource-art/adhd-in-adults.webp" || url==="/resource-art/females-with-adhd.webp")return url;
    return allowedUrl(url,imageHosts);
  }));
}
export function screenResource(item:Resource):Resource|null{
  if(!item || !["Article","Book"].includes(item.kind) || ![item.title,item.source,item.summary].every(t=>typeof t==="string" && t.trim() && safeContent(t)))return null;
  const url=allowedUrl(item.url,item.kind==="Book"?bookHosts:articleHosts);
  if(!url)return null;
  const known=[...starters,...featuredArticles].find(r=>r.url===url);
  const alternates=Array.isArray(item.imageAlternates)?item.imageAlternates.slice(0,5):[];
  return {...item,url,...withImages(approvedImages(known?.image,item.image,...known?.imageAlternates || [],...alternates)),imageCredit:allowedUrl(known?.imageCredit || item.imageCredit,[...articleHosts,"commons.wikimedia.org"]),attribution:known?.attribution || (typeof item.attribution==="string" && safeContent(item.attribution)?item.attribution:undefined)};
}
