"use client";

import {sampleShelf,sampleCategories,nextSample} from "./readingSamples";
import ReadLink,{type ReadLinkHandle} from "./ReadLink";
import ReaderComparison from "./ReaderComparison";
import HeaderActions from "./HeaderActions";
import SectionNavigator from "./SectionNavigator";
import ReaderModal from "./ReaderModal";
import Discovery from "./Discovery";
import FocusAudio from "./FocusAudio";
import { useStoredValue, rememberRead } from "./localState";
import ReadingDesk from "./ReadingDesk";
import { scheduledTheme } from "./readingTools";
import NeurodivergenceStats from "./NeurodivergenceStats";
import { useEffect, useMemo, useRef, useState } from "react";

import type {Colors} from "./readerPreferenceModel";
import {profiles,inkModes} from "./readerChoices";
import {PreferencesProvider,useReaderPreferences} from "./preferencesContext";
const studies = [
  {
    title: "Reading speed across 100 paragraphs (2024)",
    summary: "Readers worked through 100 paragraphs in standard type or with bold word beginnings. Their reading times were similar. In this experiment, adding emphasis offered no measurable speed advantage.",
    breakdown: [
      ["Who took part?", "All 32 readers were native Dutch speakers who reported normal vision and no dyslexia. The paper does not identify participants with ADHD, autism, or other neurodivergent profiles, so their representation is unknown. Each read 50 short news paragraphs in plain type and 50 with bold word beginnings. Each person saw each passage only once, and other readers saw it in the alternate format."],
      ["What did the data show?", "Comprehension checks averaged 90% across formats. The author excluded 84 unusually long reading times out of 3,200 trials (2.6%). After accounting for differences among readers and passages, the estimated speed difference fell within statistical uncertainty."],
      ["Which claim took a hit?", "The prediction was straightforward: if bold beginnings reliably speed up reading, the same readers should finish sooner with bold text. This experiment found no reliable gain. The overall comprehension score also gives no reason to claim that bolding improved understanding."],
      ["What remains open?", "A timer cannot tell whether a layout feels more comfortable or makes it easier to find your place after an interruption. The sample also leaves open how dyslexic readers perform. A follow-up could recruit dyslexic readers and readers with ADHD, let them adjust the emphasis, and measure accuracy, fatigue, and time to resume alongside speed."],
    ],
    url: "https://pubmed.ncbi.nlm.nih.gov/38723450/",
  },
  {
    title: "How bold letters affect eye movements (2025)",
    summary: "Researchers tracked readers’ eyes as they varied which letters appeared in bold. Emphasizing the beginning of a word offered no advantage over emphasizing the middle or end. Plain text performed better on some measures.",
    url: "https://pubmed.ncbi.nlm.nih.gov/40240742/",
  },
  {
    title: "Reading with specific learning disabilities (2026)",
    summary: "In a pilot with 26 young readers, the 20 with specific learning disabilities read more letters correctly per minute with bold word beginnings. The small sample and lack of standardized reading assessments limit how widely the finding applies.",
    url: "https://riviste.unime.it/index.php/JCDP/en/article/view/5056",
  },
  {
    title: "Reading academic English (2026)",
    summary: "Wang and colleagues assessed English learners’ comprehension in one experiment and tracked eye movements in another. Bolding was associated with higher comprehension accuracy and shorter fixation durations. Eye-tracking measures alone cannot tell us how quickly someone finishes a chapter.",
    url: "https://doi.org/10.1002/jcal.70354",
  },
  {
    title: "Five ways of formatting academic text (2026)",
    summary: "Zhang and colleagues compared plain text with four ways of emphasizing letters for second-language readers. Bold beginnings showed no reliable improvement in reading efficiency or comprehension. The two versions using gray letters reduced efficiency.",
    url: "https://pubmed.ncbi.nlm.nih.gov/42685589/",
  },
];

const SAMPLE_TEXT =
  "Try reading this paragraph in both panels. In the focus view, the first few letters of each word appear in bold. Which version would you choose for the next paragraph?\n\nPaste anything here—an article, an email, study notes, or the first spark of a new idea.";

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function BionicText({
  text,
  strength,
}: {
  text: string;
  strength: number;
}) {
  const tokens = text.split(/(\s+)/);

  return (
    <>
      {tokens.map((token, index) => {
        if (/^\s+$/.test(token)) return token;

        const letters = [...token];
        const letterIndexes = letters
          .map((character, characterIndex) =>
            /[\p{L}\p{N}]/u.test(character) ? characterIndex : -1,
          )
          .filter((characterIndex) => characterIndex >= 0);

        if (!letterIndexes.length) return token;

        const emphasisCount = Math.max(
          1,
          Math.ceil(letterIndexes.length * (strength / 100)),
        );
        const finalBoldIndex = letterIndexes[emphasisCount - 1];

        return (
          <span key={`${token}-${index}`}>
            <strong>{letters.slice(0, finalBoldIndex + 1).join("")}</strong>
            {letters.slice(finalBoldIndex + 1).join("")}
          </span>
        );
      })}
    </>
  );
}

const splitValue = (raw:string) => /^\d{1,3}$/.test(raw) && Number(raw)<=100 ? Number(raw) : 50;
export default function Home() {
  return <PreferencesProvider><ReaderHome/></PreferencesProvider>;
}
function ReaderHome() {
  const prefs=useReaderPreferences();
  const {strength,size:fontSize,category:sampleGroup,topic:sampleTopic}=prefs.profile;
  const [draftColors,setDraftColors]=useState<Colors|null>(null);
  const colors=draftColors || prefs.profile.colors;
  const {palette:profile,fill,ink,mode}=colors;
  const isColorPreview=Boolean(draftColors && (Object.keys(colors) as (keyof Colors)[]).some(k=>colors[k]!==prefs.profile.colors[k]));
  const setMode=(value:string)=>setDraftColors({...colors,mode:value==="dark" || value==="light"?value:"auto"});
  const setStrength=(value:number)=>prefs.apply({type:"strength",value});
  const setFontSize=(value:number)=>prefs.apply({type:"size",value});
  const [text, setText] = useStoredValue("neurotype-draft", SAMPLE_TEXT, String);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [split, saveSplit] = useStoredValue("neurotype-comparison-split",50,splitValue);
  const [colorPanel, setColorPanel] = useState({setting: "profile", open: false});
  const colorCloseTimer = useRef<number | undefined>(undefined);
  const colorOptions = useRef<HTMLDivElement>(null);

  function toggleColorPanel(setting: string) {
    window.clearTimeout(colorCloseTimer.current);
    setColorPanel(current => ({setting, open: current.setting !== setting || !current.open}));
  }

  function closeColorPanel() {
    window.clearTimeout(colorCloseTimer.current);
    if (colorOptions.current?.contains(document.activeElement)) {
      const controls = colorOptions.current.closest(".color-settings");
      controls?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus({preventScroll: true});
    }
    setColorPanel(current => ({...current, open: false}));
  }

  function scheduleColorClose() {
    window.clearTimeout(colorCloseTimer.current);
    colorCloseTimer.current = window.setTimeout(closeColorPanel, 2000);
  }
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => () => window.clearTimeout(colorCloseTimer.current), [expanded, settingsOpen]);
  const [samplesOpen,setSamplesOpen]=useState(false);
  const category=sampleCategories.includes(sampleGroup)?sampleGroup:"";
  const topics=[...new Set(sampleShelf.filter(s=>s.category===category).map(s=>s.topic))];
  const topic=topics.includes(sampleTopic)?sampleTopic:"";
  const [sampleTitle,setSampleTitle]=useState("");
  const upcoming=nextSample(category,topic,text);
  function loadSample(){
    if(!upcoming)return;
    setText(upcoming.text);setSampleTitle(upcoming.title);
  }
  const words = useMemo(() => wordCount(text), [text]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("entered-view");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    document.querySelectorAll(".mobile-settings, .reading-desk, .about-reader > div, .research-notes > article").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setTheme(mode === "light" || mode === "dark" ? mode : scheduledTheme());
    update();
    if (mode !== "auto") return;
    const timer = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [mode]);

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const toolbar = <>
    <button type="button" className="mobile-settings" aria-controls="reader-preferences" aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(current => !current)}>
          <span>Reader settings</span><span>{settingsOpen ? "−" : "+"}</span>
        </button>
        <div id="reader-preferences" data-open={settingsOpen}>
        <section className="color-settings" aria-label="Reader colors">
          <div className="settings-strip">
            {[
              { id: "profile", label: "Color profile", value: profiles.find(item => item.id === profile)?.name },
              { id: "fill", label: "Background fill", value: fill === "full" ? "Full" : "Soft" },
              { id: "ink", label: "Word color", value: ink },
            ].map(setting => (
              <button type="button" key={setting.id} aria-controls={`options-${setting.id}`}
                aria-expanded={colorPanel.open && colorPanel.setting === setting.id}
                onClick={() => toggleColorPanel(setting.id)}>
                <span>{setting.label}</span><b>{setting.value}</b>
              </button>
            ))}
            {isColorPreview && <button type="button" className="save-reader-colors" onClick={()=>{
              prefs.apply({type:"colors",value:{...colors}});setDraftColors(null);
            }}>Set as default</button>}
          </div>
        <div ref={colorOptions} className="color-drawer" data-open={colorPanel.open}
          inert={!colorPanel.open} aria-hidden={!colorPanel.open}
          onChange={scheduleColorClose}
          onClick={event => { if (event.target instanceof HTMLInputElement) scheduleColorClose(); }}
          onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); closeColorPanel(); } }}>
          <div className="color-drawer-clip">
            <fieldset id="options-profile" hidden={colorPanel.setting !== "profile"} className="profile-picker">
              <legend className="sr-only">Color profile</legend>
              <div className="profile-options">
                {profiles.map((item) => (
                  <label key={item.id} className="profile-option">
                    <input type="radio" name="color-profile" checked={profile === item.id}
                      onChange={() => {
                        setDraftColors({...colors,palette:item.id});
                        prefs.apply({type:"observePalette",value:item.id});
                      }} />
                    <span className="swatch" style={{ background: item.swatch }} aria-hidden="true" />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset id="options-fill" hidden={colorPanel.setting !== "fill"} className="profile-picker">
              <legend className="sr-only">Background fill</legend>
              <div className="profile-options">
                {(["full", "soft"] as const).map(option => <label key={option} className="profile-option">
                  <input type="radio" name="background-fill" checked={fill === option} onChange={() => {
                    setDraftColors({...colors,fill:option});
                  }} />{option === "full" ? "Full" : "Soft"}
                </label>)}
              </div>
            </fieldset>

            <fieldset id="options-ink" hidden={colorPanel.setting !== "ink"} className="profile-picker ink-picker">
              <legend className="sr-only">Word color</legend>
              <div className="profile-options">
                {inkModes.map((mode) => (
                  <label className="profile-option ink-option" key={mode}>
                    <input type="radio" name="word-color" checked={ink === mode} onChange={() => {
                      setDraftColors({...colors,ink:mode});
                    }} />
                    {mode}
                  </label>
                ))}
                <span className="ink-example" aria-label="Word color preview"><span><strong>Rea</strong>ding</span> <span><strong>rhy</strong>thm</span></span>
              </div>
            </fieldset>
          </div>
        </div>
        </section>

        <section className="control-rail" aria-label="Reader controls">
          <div className="control-group strength-control">
            <div className="control-heading">
              <label htmlFor="strength">FOCUS STRENGTH</label>
              <output htmlFor="strength">{strength}%</output>
            </div>
            <input
              id="strength"
              type="range"
              min="25"
              max="75"
              step="5"
              value={strength}
              onChange={(event) => setStrength(Number(event.target.value))}
              style={{ "--progress": `${((strength - 25) / 50) * 100}%` } as React.CSSProperties}
            />
          </div>

          <div className="divider" />

          <div className="control-group size-control">
            <span className="control-label">TEXT SIZE</span>
            <div className="segmented">
              {[18, 21, 25].map((size, index) => (
                <button
                  key={size}
                  className={fontSize === size ? "active" : ""}
                  onClick={() => setFontSize(size)}
                  aria-label={`Set ${["small", "medium", "large"][index]} text`}
                  aria-pressed={fontSize === size}
                >
                  A{index ? <sup>{index + 1}</sup> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="control-actions">
            <button type="button" className="ghost-button" onClick={loadSample}>Load sample</button>
            <button className="ghost-button sample-options" type="button" aria-label="Choose sample category and topic" aria-controls="sample-options"
              aria-expanded={samplesOpen} title="Sample categories" onClick={()=>setSamplesOpen(open=>!open)}>▾</button>
            <button className="ghost-button" onClick={() => setText("")}>
              CLEAR
            </button>
          </div>
        </section>
        {samplesOpen && <div id="sample-options" className="sample-picker">
          <label>Sample category<select value={category} onChange={e=>{prefs.apply({type:"sample",category:e.target.value,topic:""});}}>
            <option value="">All samples</option>{sampleCategories.map(c=><option key={c}>{c}</option>)}</select></label>
          {category && <label>Topic<select value={topic} onChange={e=>prefs.apply({type:"sample",category,topic:e.target.value})}><option value="">All topics</option>
            {topics.map(t=><option key={t}>{t}</option>)}</select></label>}
          {upcoming && <button type="button" className="sample-load" onClick={loadSample}>Load “{upcoming.title}”</button>}
        </div>}
        <span className="sr-only" role="status">{sampleTitle && "Loaded "+sampleTitle}</span>
        </div>
  </>;

  const linkEditor=useRef<ReadLinkHandle>(null);
  const comparison = <><ReadLink ref={linkEditor} hasDraft={Boolean(text.trim())} apply={value=>{
    if(text.trim())rememberRead(text);
    setText(value);saveSplit(50);
    requestAnimationFrame(()=>document.getElementById("reader-input")?.focus({preventScroll:true}));
  }}/><ReaderComparison split={split} saveSplit={saveSplit} quiet={profile==="paper" || profile==="graphite"}>
          <article id="input-panel" className="panel input-panel">
            <header className="panel-header">
              <div>
                <span className="panel-number">01</span>
                <h2>INPUT STREAM</h2>
              </div>
              <span className="panel-meta">{words} WORDS</span>
            </header>
            <div className="panel-body">
              <textarea id="reader-input"
                aria-label="Paste text to transform"
                value={text}
                onBlur={() => rememberRead(text)}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste your text here..."
                spellCheck="true"
              />
            </div>
            <footer className="panel-footer">
              <span>PASTE OR TYPE TO BEGIN</span>
              <span className="key-hint">LIVE INPUT</span>
            </footer>
          </article>

          <div className="transfer" aria-hidden="true">
            <span>→</span>
          </div>

          <article id="output-panel" className="panel output-panel">
            <header className="panel-header">
              <div>
                <span className="panel-number">02</span>
                <h2>FOCUS OUTPUT</h2>
              </div>
              <span className="live-chip">
                <span />
                LIVE
              </span>
            </header>
            <div
              className={`panel-body output-text ${text ? "" : "empty"}`}
              style={{ fontSize: `${fontSize}px` }}
              aria-live="polite"
            >
              {text ? (
                <BionicText text={text} strength={strength} />
              ) : (
                "Your transformed text will appear here."
              )}
            </div>
            <footer className="panel-footer">
              <span>FOCUS LAYER ACTIVE</span>
              <button className="copy-button" onClick={copyText} disabled={!text}>
                {copied ? "COPIED ✓" : "COPY TEXT"}
              </button>
            </footer>
          </article>
  </ReaderComparison></>;

  return (
    <main id="home" data-theme={theme} data-profile={profile} data-ink={ink} data-fill={fill}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#" aria-label="Neurotype home">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>NEUROTYPE</span>
        </a>
        <HeaderActions mode={mode} theme={theme} setMode={setMode}/>
      </nav>

      <div className="shell">
        <header className="hero">
          <div className="glass-study" aria-hidden="true">
            <span className="glass-sheet rear-sheet" />
            <span className="glass-sheet type-sheet"><span><b>Fo</b>cus</span><i /><i /></span>
            <span className="optical-disc"><b>Fo</b></span>
          </div>
          <div className="hero-title">
            <p className="eyebrow">
              PERSONAL READING WORKSPACE
            </p>
            <h1 className="flow-headline">
              <span className="reading-title">Reading</span>{" "}
              <em className="flow-title">ON Flow State</em>
            </h1>
          </div>
          <div className="hero-aside"><h2>Focus on the essentials</h2><p className="hero-copy">
            Paste a passage or open an article link. Compare plain text with bold word beginnings and adjust the emphasis as you read.
          </p>
            <button type="button" className="hero-action" aria-haspopup="dialog" onClick={() => {
              setExpanded(true);
            }}>Open reader</button>
          </div>
        </header>

        {!expanded && <div id="reader-settings">{toolbar}</div>}
        <div className="editor-launch"><button type="button" aria-haspopup="dialog" onClick={()=>setExpanded(true)}><span aria-hidden="true">⛶</span> Expand editor</button></div>
        {expanded ? <ReaderModal wide title="Reading workspace" close={()=>setExpanded(false)}>{toolbar}{comparison}</ReaderModal> : comparison}

        <ReadingDesk text={text} open={value => { setText(value); saveSplit(100); requestAnimationFrame(() => document.getElementById("reader-input")?.focus()); }} />

        <section id="about" className="about-reader" aria-labelledby="about-title">
          <div>
            <h2 id="about-title">About Neurotype Reader</h2>
            <p>See the opening letters of each word in bold. Compare the two views as you adjust.</p>
            <details><summary>How to use the reader</summary>
              <ol><li>Paste a passage into <b>Input Stream</b>, or choose <b>Read from a link</b> to preview an article.</li>
              <li>Move <b>Focus Strength</b> to change how much of each word appears bold in Focus Output.</li>
              <li>Select <b>Summarize</b> for key statements or <b>Save read</b> to keep the passage.</li></ol>
            </details>
            <details><summary>Choosing a color for focus</summary>
            <p>
              If bright white feels harsh, try Soft Maize in light mode for a
              warm, paper-like background. The British Dyslexia Association
              suggests cream or soft pastels and recognizes that preferences vary.
              Research hasn’t established a single focus color for neurodivergent
              readers. Try the same paragraph in two profiles and see which feels
              easier to settle into.
            </p>
            <p className="profile-sources">
              <a href="https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf">Dyslexia style guide</a>
              <a href="https://pubmed.ncbi.nlm.nih.gov/27580753/">Review of tinted lenses and overlays</a>
            </p>
            </details>
          </div>
          <div>
            <h3 id="reading-research">Do bold word beginnings help?</h3>
            <p>Try the same paragraph in plain and focus view. Speed, understanding and comfort are different reasons to choose a format.</p>
            <ul className="reading-findings">
              <li><b>Speed.</b> In a 100-paragraph experiment, 32 Dutch readers took about as long with either format. <a href={studies[0].url}>Snell, 2024</a></li>
              <li><b>Understanding.</b> Two academic-reading studies with second-language readers reached different results. One found higher comprehension scores with bold beginnings. The other found similar scores with plain text. <a href="https://doi.org/10.1002/jcal.70354">Wang et al., 2026</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/42685589/">Zhang et al., 2026</a></li>
              <li><b>Decoding.</b> In a small pilot, 20 students with specific learning disabilities read more letters correctly per minute with bold beginnings. The task measured letter reading. Passage comprehension remains an open question for this group. <a href={studies[2].url}>Vascelli et al., 2026</a></li>
            </ul>
            <p><b>Still open.</b> These studies give little guidance on whether adjustable emphasis helps readers with ADHD keep their place after an interruption or feel less tired over a chapter.</p>
            <details className="study-summaries">
              <summary>Study designs and limits</summary>
              {studies.map((study) => (
                <article key={study.url}>
                  <h4>{study.title}</h4>
                  <p>{study.summary}</p>
                  {study.breakdown && (
                    <details className="paper-detail">
                      <summary>Inside the experiment</summary>
                      <dl>{study.breakdown.map(([question, answer]) => (
                        <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>
                      ))}</dl>
                      <a href="https://doi.org/10.1016/j.actpsy.2024.104304">Full paper and methods</a>
                    </details>
                  )}
                  <a href={study.url} aria-label={`Read the source for ${study.title}`}>Read the source</a>
                </article>
              ))}
            </details>
          </div>
        </section>

        <NeurodivergenceStats quiet={profile === "paper" || profile === "graphite"} />

        <Discovery readInEditor={url=>requestAnimationFrame(()=>linkEditor.current?.openArticle(url))}/>
        <FocusAudio editorOpen={expanded} closeEditor={()=>setExpanded(false)} />

        <footer className="site-footer">
          <p>
            <span className="footer-icon">N</span>
            <span>created by <a href="https://www.linkedin.com/in/aylabasha/">Ayla Basha</a></span>
          </p>
          <p>PASSAGES SAVED ON THIS DEVICE</p>
        </footer>
      </div>
      {!expanded && <SectionNavigator/>}
      <div id="nav-music-slot" />
    </main>
  );
}
