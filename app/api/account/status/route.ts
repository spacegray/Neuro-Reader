import {getStatus} from "../../../moderation/status";
export const dynamic="force-dynamic";
export function GET(request:Request){return getStatus(request);}
