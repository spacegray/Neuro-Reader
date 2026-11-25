import {runtimeEnv} from "../../../moderation/guard";
import {getReview,postReview} from "../../../moderation/reviewService";
export const dynamic="force-dynamic";
export async function GET(request:Request){return getReview(request,await runtimeEnv());}
export async function POST(request:Request){return postReview(request,await runtimeEnv());}
