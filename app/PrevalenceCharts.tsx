import type {ReactNode} from "react";

export const studySources = {
  adhd: {label: "CDC adult ADHD survey", url: "https://www.cdc.gov/mmwr/volumes/73/wr/mm7340a1.htm"},
  autism: {label: "CDC autism monitoring report", url: "https://www.cdc.gov/mmwr/volumes/74/ss/ss7402a1.htm"},
  dyslexia: {label: "Dyslexia prevalence review", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8870220/"},
};

export const studyEstimates = {
  adhd: { millions: 15.5, percent: 6 },
  autism: { oneIn: 31, axisMax: 60, sites: [
    { label: "Laredo site", rate: 9.7 },
    { label: "All 16 sites", rate: 32.2 },
    { label: "San Diego site", rate: 53.1 },
  ] },
  dyslexia: { percent: 7.10, low: 6.27, high: 7.97, axisMax: 10 },
};

function figurePercent(value: number, max: number) {
  return Number((100 * value / max).toFixed(3)) + "%";
}

function StudyFigure({study, question, children}: {
  study: keyof typeof studySources; question: string; children: ReactNode;
}) {
  const source = studySources[study];
  return <figure className="study-figure" aria-labelledby={`figure-${study}`}>
    <figcaption id={`figure-${study}`}>{question}</figcaption>
    {children}
    <a className="study-source" href={source.url}>{source.label} <span aria-hidden="true">↗</span></a>
  </figure>;
}

export function AdhdFrequency() {
  const percent = studyEstimates.adhd.percent;
  return <StudyFigure study="adhd" question="How many adults reported ADHD?">
    <div className="adult-frequency chart-marks" aria-hidden="true">
      {Array.from({length:100}, (_, i) =>
        <i key={i} className={i < percent ? "frequency-dot filled" : "frequency-dot"}/>)}
    </div>
    <p className="study-reading"><b>{percent.toFixed(1)}%</b> of U.S. adults aged 18 or older. Each dot represents 1% of adults.</p>
  </StudyFigure>;
}

export function AutismSiteRates() {
  const {sites, axisMax} = studyEstimates.autism;
  return <StudyFigure study="autism" question="How did identification vary by site?">
    <div className="site-rate-list">
      {sites.map(site => <div className="site-rate" key={site.label}>
        <div><span>{site.label}</span><b>{site.rate.toFixed(1)}</b></div>
        <div className="site-rate-track" aria-hidden="true"><i className="chart-marks" style={{width:figurePercent(site.rate,axisMax)}}/></div>
      </div>)}
      <div className="study-axis" aria-hidden="true"><span>0</span><span>{axisMax}</span></div>
    </div>
    <p className="study-reading">Identified per 1,000 eight-year-olds in 2022. The two sites shown had the lowest and highest rates.</p>
  </StudyFigure>;
}

export function DyslexiaInterval() {
  const {percent, low, high, axisMax} = studyEstimates.dyslexia;
  return <StudyFigure study="dyslexia" question="How precise is the pooled estimate?">
    <div className="confidence-plot" aria-hidden="true">
      <div className="confidence-axis">
        <i className="confidence-range chart-marks" style={{left:figurePercent(low,axisMax),width:figurePercent(high-low,axisMax)}}/>
        <i className="confidence-point" style={{left:figurePercent(percent,axisMax)}}/>
      </div>
      <div className="study-axis"><span>0%</span><span>5%</span><span>{axisMax}%</span></div>
    </div>
    <p className="study-reading">The dot marks <b>{percent.toFixed(2)}%</b>. The line spans the 95% confidence interval, <b>{low}% to {high}%</b>, for the pooled estimate.</p>
  </StudyFigure>;
}
