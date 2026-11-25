import "../moderation/review.css";
export default function ClosedProfile(){
  return <main className="review-page"><article><h1>Reader profile deleted</h1>
    <p>Your saved account preferences and music collection have been removed. Neurotype retains a closure receipt and any records needed for an active restriction.</p>
    <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></article></main>;
}
