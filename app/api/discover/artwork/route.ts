import {approvedImages} from "../../../discoverySafety";
import {sourceArtworkKey,coverImage} from "../../../resourceImages";
import {safeContent} from "../../../moderation/policy";

export const dynamic="force-dynamic";
async function lookup(source:NonNullable<ReturnType<typeof sourceArtworkKey>>) {
  const read=async(url:URL)=>{
    const r=await fetch(url,{headers:{"User-Agent":"NeurotypeReader/1.0 (https://neurotype-reader.urbansafariwear.chatgpt.site/)"},signal:AbortSignal.timeout(4000)});
    if(!r.ok)throw new Error("Artwork unavailable");
    return r.json();
  };
  if(source.provider==="openlibrary"){
    const work=await read(new URL("/works/"+source.id+".json","https://openlibrary.org")) as {covers?:number[]};
    return approvedImages(...(work.covers||[]).slice(0,3).map(id=>coverImage("id",id)));
  }
  if(source.provider==="googlebooks"){
    const data=await read(new URL("/books/v1/volumes/"+source.id,"https://www.googleapis.com")) as {volumeInfo?:{maturityRating?:string;imageLinks?:{thumbnail?:string;smallThumbnail?:string}}};
    if(data.volumeInfo?.maturityRating!=="NOT_MATURE")return [];
    return approvedImages(data.volumeInfo.imageLinks?.thumbnail,data.volumeInfo.imageLinks?.smallThumbnail);
  }
  const wiki=new URL("https://en.wikipedia.org/w/api.php");
  wiki.search=new URLSearchParams({action:"query",titles:source.id,redirects:"1",prop:"pageimages",piprop:"thumbnail|original",pilicense:"free",pithumbsize:"330",format:"json",formatversion:"2"}).toString();
  const data=await read(wiki) as {query?:{pages?:{thumbnail?:{source?:string};original?:{source?:string}}[]}};
  const page=data.query?.pages?.[0];
  return approvedImages(page?.thumbnail?.source,page?.original?.source);
}
export async function GET(request:Request){
  const raw=new URL(request.url).searchParams.get("source");
  const source=raw && sourceArtworkKey(raw);
  if(!source || !safeContent(source.id))return Response.json({images:[]},{status:400});
  try{return Response.json({images:await lookup(source)},{headers:{"Cache-Control":"public, max-age=3600"}});
  }catch{return Response.json({images:[]},{status:503,headers:{"Cache-Control":"no-store"}});}
}
