import {useEffect, useId, useRef, useState, type ReactNode} from "react";
import "./researchDisclosures.css";
import {AdhdFrequency, AutismSiteRates, DyslexiaInterval, studyEstimates, studySources} from "./PrevalenceCharts";
import FactCard from "./FactCard";

const readingGrace = 30_000;
type OpenFact = { index: number; since: number; pinned: boolean };

function ResearchNote({title, expanded, toggle, children}: {
  title: string; expanded: boolean; toggle: () => void; children: ReactNode;
}){
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return <article><h3><button type="button" ref={trigger} className="fact-toggle" aria-controls={id}
    aria-expanded={expanded} onClick={toggle}>{title}</button></h3>
    <div id={id} className="fact-reveal" data-expanded={expanded} inert={!expanded} aria-hidden={!expanded}>
      <div>{children}<button type="button" className="research-close" onClick={() => {
        trigger.current?.focus({preventScroll:true}); toggle();
      }}>Close section ×</button></div>
    </div>
  </article>;
}

export default function NeurodivergenceStats({ quiet }: { quiet: boolean }) {
  const [fact, setFact] = useState<number | null>(null);
  const [openNotes, setOpenNotes] = useState([true, true]);
  const current = useRef<OpenFact | null>(null);
  const pending = useRef<{index:number; timer:ReturnType<typeof setTimeout>} | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function cancelPreview() {
    clearTimeout(pending.current?.timer);
    pending.current = null;
  }
  useEffect(() => () => { clearTimeout(pending.current?.timer); clearTimeout(closing.current); }, []);

  function show(index: number | null, pinned = false) {
    cancelPreview();
    clearTimeout(closing.current);
    current.current = index === null ? null : {index, since:Date.now(), pinned};
    setFact(index);
  }
  function preview(index: number) {
    const open = current.current;
    cancelPreview();
    if (open?.index === index) { clearTimeout(closing.current); return; }
    if (open?.pinned) return;
    const delay = Math.max(350, open ? open.since + readingGrace - Date.now() : 0);
    pending.current = {index, timer:setTimeout(() => show(index), delay)};
  }
  function stay(index: number) {
    if (current.current?.index === index) { clearTimeout(closing.current); cancelPreview(); }
  }
  function leave(index: number) {
    if (pending.current?.index === index) cancelPreview();
    if (current.current?.index !== index || current.current.pinned) return;
    clearTimeout(closing.current);
    closing.current = setTimeout(() => {
      // A reader hovering the next title may already be waiting for this one to close.
      if (!pending.current) show(null);
    }, readingGrace);
  }
  const interactions = {
    preview, stay, leave,
    toggle(index: number) { show(current.current?.index === index ? null : index, true); },
    close() { show(null); },
  };
  function toggleNote(index:number) {
    const restoring = current.current !== null;
    show(null);
    setOpenNotes(previous => previous.map((open, i) => i === index ? restoring || !open : open));
  }

  return (
    <section id="neurodivergence" className="research-stats" aria-labelledby="stats-title">
      <h2 id="stats-title">Neurodivergence by the numbers</h2>
      <p className="stats-intro">Population estimates describe who was counted in surveys and schools. For experiments on the editor’s formatting, see <a href="#reading-research">reading research</a>.</p>
      <details className="population-disclosure"><summary>Explore population estimates and research gaps</summary>
      <p className="stats-intro">These estimates cover different populations. ADHD, autism, and dyslexia can overlap.</p>

      <div className="stat-grid">
        <FactCard {...interactions} index={0} expanded={fact === 0} quiet={quiet} title="ADHD in U.S. adults" value={studyEstimates.adhd.millions} chart={<AdhdFrequency/>} suffix=" million" caption="U.S. adults reporting a current ADHD diagnosis in 2023.">
          <p>CDC weighted 7,046 interviews from October and November 2023 to estimate how many U.S. adults reported both a professional diagnosis and current ADHD. Among adults reporting current ADHD, 55.9% recalled receiving their first diagnosis at age 18 or older.</p>
        </FactCard>
        <FactCard {...interactions} index={1} expanded={fact === 1} quiet={quiet} title="Autism at age eight" value={studyEstimates.autism.oneIn} chart={<AutismSiteRates/>} prefix="1 in " caption="Eight-year-olds identified as autistic across 16 U.S. monitoring sites in 2022.">
          <p>At the 16 sites, 8,854 of 274,857 eight-year-olds met the records-based definition through a diagnostic statement, a special education record of autism eligibility, or an autism diagnostic code. Among those with a diagnostic statement in an evaluation, the median age at first recorded diagnosis was 47 months.</p>
        </FactCard>
        <FactCard {...interactions} index={2} expanded={fact === 2} quiet={quiet} title="Dyslexia in primary school" value={studyEstimates.dyslexia.percent} chart={<DyslexiaInterval/>} suffix="%" caption="Pooled prevalence among primary school pupils in a 2022 review of 58 studies.">
          <p>The 2022 review pooled 58 studies of primary school pupils aged 6–13, found in a literature search through June 2021. The estimate is about one in 14. The confidence interval describes uncertainty about that average. Individual schools can fall outside it.</p>
        </FactCard>
      </div>

      <details className="study-gaps">
        <summary>Research gaps and limits</summary>
        <ul>
          <li><b>ADHD.</b> The survey relied on recall and reached a small share of invited panelists. Checking responses against clinical records and following people over time would help explain delays in diagnosis. <a href={studySources.adhd.url}>Survey limitations</a></li>
          <li><b>Autism.</b> Access to evaluations and record coverage differ across sites. These communities show local differences. A national estimate would require a representative sample. <a href={studySources.autism.url}>Surveillance limitations</a></li>
          <li><b>Dyslexia.</b> Studies used different identification thresholds. All came from middle- or high-income countries. More evidence from low-income countries and across school grades would improve coverage. <a href={studySources.dyslexia.url}>Review limitations</a></li>
        </ul>
      </details>
      <div className="research-notes" data-both-open={fact === null && openNotes.every(Boolean)}>
        <ResearchNote title="Who gets noticed in the classroom?" expanded={fact === null && openNotes[0]} toggle={() => toggleNote(0)}>
          <p>A girl who quietly loses track of instructions may draw less attention than a classmate who interrupts. When referrals depend on what adults notice, some girls with ADHD can reach adulthood before anyone asks about the effort school took.</p>
          <details><summary>Age at first diagnosis</summary><ul><li>In Stockholm County, researchers examined records for 85,330 people with ADHD. The first recorded diagnosis or ADHD prescription occurred at an average age of 23.5 for females and 19.6 for males. </li><li>Those ages reflect contact with care during the study period. Symptoms may have started years earlier.</li></ul></details>
          <details><summary>What researchers want to learn</summary><p>One priority for research is to recruit girls before a clinical referral and follow them into adulthood. That would help answer which early signs predict a later diagnosis and which school referral practices help girls get support sooner.</p></details>
          <p className="profile-sources"><a href="https://pubmed.ncbi.nlm.nih.gov/38016697/">Stockholm register study</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7422602/">Consensus on ADHD in girls and women</a></p>
        </ResearchNote>
        <ResearchNote title="How much research is there?" expanded={fact === null && openNotes[1]} toggle={() => toggleNote(1)}>
          <p>One 2021 review alone included 334 studies on possible ADHD overdiagnosis in children and adolescents. A different review combined 58 studies on dyslexia prevalence. Those counts show how much work can go into answering even one question. Neither review counted the entire field or tested this reader.</p>
          <details><summary>Did you know?</summary><p>A child’s birthday can influence who gets noticed at school. In the ADHD review, 11 of 12 studies examining relative age found that the youngest children in a class were more likely to receive a diagnosis than their older classmates. That pattern raises a question about how adults compare children at different stages of development.</p></details>
          <p><a href="https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2778451">Read the ADHD scoping review</a></p>
        </ResearchNote>
      </div>
      </details>
    </section>
  );
}
