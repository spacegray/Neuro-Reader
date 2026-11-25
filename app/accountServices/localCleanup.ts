export function clearDeletedReaderData(userId:string) {
  try{
    localStorage.removeItem("neurotype-music-v2:user:"+userId);
    localStorage.removeItem("neurotype-youtube-last-user:"+userId);
  }catch{/* Private browsing. */}
}
