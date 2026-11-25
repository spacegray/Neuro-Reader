# Neurotype Reader

A reading workspace built by **Ayla Basha**. Paste a passage, adjust how much of each word is emphasized, and compare the result with the original. The comparison happens in the browser, so a reader can try different settings on the same sentence without waiting for a server response.

[Open the live reader](https://neurotype-reader.urbansafariwear.chatgpt.site/)

![Editor mockup showing the opening lines of “Return slot” in plain text and with 40% word emphasis.](docs/mockups/reader-workspace.svg)

## Try the comparison

1. Open the reader and choose **Load sample**, or paste a paragraph of your own.
2. Select **Compare** and move **Focus strength**. The words and punctuation stay in place while the bold prefix changes. The divider also responds to arrow keys, Home, and End.
3. Choose **Focus view** to read the formatted passage on its own. **Summarize** extracts key sentences in their original order when you want a shorter read.

I built the comparison so readers can answer *“Which version of this passage feels easier to follow?”* using their own text. The research section links to studies and explains what each measured. Reading comfort, speed, and comprehension are separate outcomes.

## Bringing an article into the editor

On the reference shelf, open a supported article and choose **Read in text editor**. The importer fills in its URL and shows the source, a preview, and a word count. If there is already a passage on the desk, **Replace editor text** makes that decision explicit. The app saves the previous passage to local reading history when you replace it.

![Article-import mockup showing the NIMH article preview, its URL in the reader, and the explicit replacement action.](docs/mockups/article-import.svg)

## Engineering decisions

| Problem | Implementation |
| --- | --- |
| Keep live formatting predictable | The [editor](app/page.tsx) preserves whitespace tokens, counts Unicode letters and numbers, and renders the emphasized prefix as a React text node inside `strong`. The [comparison control](app/ReaderComparison.tsx) shares one split position between pointer and keyboard input. |
| Extract useful text from a URL | The [importer](app/api/read-link/importer.ts) checks supported publisher paths at every redirect, bounds the response size, and extracts paragraphs, headings, and list items. PubMed links import the abstract. Both the shelf and the server use the same [URL rules](app/articleUrl.ts). |
| Make a summary traceable to the passage | The [summarizer](app/readingTools.ts) segments sentences, ranks them using recurring terms and action words, and returns up to four original sentences in source order. It runs locally without a model call. |
| Keep audio useful when search quota runs out | [Focus audio](app/FocusAudio.tsx) combines a player, queue, and saved collections. YouTube-wide searches use a server-held key and a signed-in account. [Provider logic](app/api/youtube-search/provider.ts) can fall back to public channel feeds. |
| Separate on-device and account data | [Local history](app/localState.ts) keeps up to 15 saved passages on the device. Signed-in music collections and reader preferences use D1. The [Worker entry point](worker/index.ts) applies request and account checks before passing traffic to the app. |

## Run locally

The UI uses React 19 and TypeScript with App Router conventions. Vinext runs it on Vite and builds a Cloudflare Worker. Drizzle describes the D1 schema. Use **Node.js 24** for the commands below. The build scripts target Linux with Bash, GNU `timeout`, `flock`, `sha256sum`, and `curl`. On macOS, a Linux development container provides those tools.

```sh
git clone https://github.com/spacegray/Neuro-Reader.git
cd Neuro-Reader
npm run install:ci
npm run build

# On a fresh checkout, initialize the local D1 database once.
for migration in drizzle/*.sql; do
  npx wrangler d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$migration" || break
done

npm run dev
```

Open the local URL printed by Vite. Start with a sample passage to use the editor without provider credentials. The hosted site supplies sign-in and provisions the database. The local Worker also uses D1 for request counters, including on the home page. The [SQL migrations](drizzle) create those tables alongside the account data.

### Verification

```sh
npm test
node --test tests/*.test.mjs
npx wrangler types ./worker-configuration.d.ts --config dist/server/wrangler.json
npx tsc --noEmit --incremental false
```

Run these in order. `npm test` builds the Worker and checks its rendered HTML. The full suite also exercises article extraction, reader preferences, queue behavior, moderation, and request limits. Wrangler generates the runtime declarations from the build output for the final type check.

### Optional services

Configure credentials in the hosting environment. The [example environment file](.env.example) lists the available settings.

| Feature | Runtime settings |
| --- | --- |
| YouTube-wide music search | `YOUTUBE_API_KEY` |
| Google AI Overviews or source-based Gemini answers | `SERPAPI_API_KEY` or `GEMINI_API_KEY` |
| Reviewer access and outbound feedback email | `MODERATION_OWNER_EMAIL`, `RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL` |

[Live demo](https://neurotype-reader.urbansafariwear.chatgpt.site/) · [Ayla Basha on LinkedIn](https://www.linkedin.com/in/aylabasha/)
