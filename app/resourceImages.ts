import type {Resource} from "./resources";

export function coverImage(type:"id"|"isbn"|"olid",value:unknown) {
  const key=String(value??"");
  const valid=type==="id"?/^[1-9]\d{0,11}$/:type==="olid"?/^OL\d+M$/:/^(?:\d{13}|\d{9}[\dX])$/i;
  return valid.test(key)?"https://covers.openlibrary.org/b/"+type+"/"+key+"-M.jpg?default=false":undefined;
}
export function imageList(...urls:(string|undefined)[]) {
  return [...new Set(urls.filter((u):u is string=>!!u))].slice(0,6);
}
export function withImages(images:string[]) {
  return {image:images[0],imageAlternates:images.slice(1)};
}
export function openLibraryImages(book:{cover_i?:number;cover_edition_key?:string;isbn?:string[]}) {
  return imageList(coverImage("id",book.cover_i),coverImage("olid",book.cover_edition_key),...(book.isbn||[]).slice(0,4).map(i=>coverImage("isbn",i)));
}
// A source-specific identifier allows an old saved record to recover its own thumbnail.
export function sourceArtworkKey(raw:string) {
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:" || url.username || url.password || url.port || raw.length>600)return null;
    if(url.hostname==="openlibrary.org"){
      const id=url.pathname.match(/^\/works\/(OL\d{1,12}W)(?:\/|$)/)?.[1];
      return id?{provider:"openlibrary",id}:null;
    }
    if(url.hostname==="en.wikipedia.org" && url.pathname.startsWith("/wiki/")){
      const id=decodeURIComponent(url.pathname.slice(6));
      if(id && id.length<=180 && !/[:|?#<>\u0000-\u001f]/.test(id))return {provider:"wikipedia",id};
    }
    if(url.hostname==="books.google.com"){
      const id=url.searchParams.get("id");
      if(id && /^[\w-]{5,32}$/.test(id))return {provider:"googlebooks",id};
    }
  }catch{/* Unrecognized records use their theme illustration. */}
  return null;
}
export function artworkSignature(item:Pick<Resource,"url"|"title">) {
  let hash=2166136261;
  for(const c of item.url+"|"+item.title)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return hash>>>0;
}
