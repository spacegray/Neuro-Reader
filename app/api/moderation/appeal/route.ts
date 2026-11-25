import {runtimeEnv} from "../../../moderation/guard";
import {getAppeal,postAppeal} from "../../../moderation/appealService";
export const dynamic="force-dynamic";
export async function GET(request:Request){return getAppeal(request,await runtimeEnv());}
export async function POST(request:Request){return postAppeal(request,await runtimeEnv());}
