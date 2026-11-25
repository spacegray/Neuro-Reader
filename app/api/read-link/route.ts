import {boundedJson,json} from "../../moderation/guard";
import {publicArticle} from "../../articleUrl";
import {importArticle} from "./importer";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const body=await boundedJson(request,4096);
  const url=publicArticle(body?.url);
  if(!url)return json({error:"Use a public HTTPS article link from a supported publisher, or paste the text directly."},400);
  try{return json(await importArticle(url,AbortSignal.any([request.signal,AbortSignal.timeout(9000)])));}
  catch(e){
    const known=e instanceof Error && /^(There wasn’t|This page is too large|The publisher didn’t)/.test(e.message);
    return json({error:known?(e as Error).message:"Couldn’t load this page. Try again or paste your passage."},422);
  }
}
