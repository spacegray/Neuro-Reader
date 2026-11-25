import {runtimeEnv} from "../../../moderation/guard";
import {feedback} from "../../../accountServices/correspondence";
export const dynamic="force-dynamic";
export async function POST(request:Request){return feedback(request,await runtimeEnv());}
