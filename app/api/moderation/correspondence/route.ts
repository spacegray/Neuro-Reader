import {runtimeEnv} from "../../../moderation/guard";
import {reviewerInbox} from "../../../accountServices/correspondence";
export const dynamic="force-dynamic";
export async function GET(request:Request){return reviewerInbox(request,await runtimeEnv());}
