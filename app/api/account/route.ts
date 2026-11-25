import {isReviewer,runtimeEnv} from "../../moderation/guard";
import {chatGPTSignInPath,chatGPTSignOutPath} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(request:Request) {
  const headers=request.headers;
  const id=headers.get("oai-authenticated-user-id");
  const email=headers.get("oai-authenticated-user-email");
  let name=headers.get("oai-authenticated-user-full-name");
  if(name && headers.get("oai-authenticated-user-full-name-encoding")==="percent-encoded-utf-8"){
    try{name=decodeURIComponent(name);}catch{name=null;}
  }
  return Response.json({
    user:id ? {id,email,name:name || email || "Reader"} : null,
    reviewer:Boolean(id && isReviewer(request,await runtimeEnv())),
    signIn:chatGPTSignInPath("/"),signOut:chatGPTSignOutPath("/")
  },{headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
}
