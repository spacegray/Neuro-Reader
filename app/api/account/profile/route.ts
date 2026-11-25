import {runtimeEnv} from "../../../moderation/guard";
import {deleteProfile} from "../../../accountServices/deletion";
export const dynamic="force-dynamic";
export async function DELETE(request:Request){return deleteProfile(request,await runtimeEnv());}
