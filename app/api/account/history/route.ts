import {runtimeEnv} from "../../../moderation/guard";
import {accountHistory} from "../../../accountServices/correspondence";
export const dynamic="force-dynamic";
export async function GET(request:Request){return accountHistory(request,await runtimeEnv());}
