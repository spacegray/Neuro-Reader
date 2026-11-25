import assert from "node:assert/strict";
import {before, test} from "node:test";
import {createRequire} from "node:module";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFile} from "node:fs/promises";
import ts from "typescript";

// Exercise the real chart components without requiring a build of the entire Worker.
const require = createRequire(import.meta.url);
let charts;
before(async () => {
  const url = new URL("../app/PrevalenceCharts.tsx", import.meta.url);
  const source = await readFile(url, "utf8");
  const {outputText} = ts.transpileModule(source, {
    fileName:url.pathname,
    compilerOptions:{module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022},
  });
  charts = {};
  new Function("require", "exports", outputText)(require, charts);
});
const render = Component => renderToStaticMarkup(createElement(Component));
test("adult ADHD frequency chart renders six of 100 dots and identifies its denominator and source", () => {
  const html = render(charts.AdhdFrequency);
  assert.equal((html.match(/class="frequency-dot(?: filled)?"/g) || []).length, 100);
  assert.equal((html.match(/class="frequency-dot filled"/g) || []).length, 6);
  assert.match(html, /6\.0%/);
  assert.match(html, /U\.S\. adults aged 18 or older/);
  assert.match(html, /mm7340a1\.htm/);
});
test("autism site bars encode each printed rate from the same zero baseline and scale", () => {
  const html = render(charts.AutismSiteRates);
  const widths = Array.from(html.matchAll(/style="width:([\d.]+)%"/g), m => Number(m[1]));
  assert.equal(widths.length, 3);
  for (const [i, [site, rate]] of [["Laredo site",9.7], ["All 16 sites",32.2], ["San Diego site",53.1]].entries()) {
    assert.ok(html.includes(site + "</span><b>" + rate));
    assert.ok(Math.abs(widths[i] / 100 * 60 - rate) < .001);
  }
  assert.match(html, /per 1,000 eight-year-olds in 2022/);
  assert.match(html, /ss7402a1\.htm/);
});
test("dyslexia chart places its estimate and both confidence bounds on the labeled 0–10 percent axis", () => {
  const html = render(charts.DyslexiaInterval);
  assert.match(html, /class="confidence-range chart-marks" style="left:62\.7%;width:17%"/);
  assert.match(html, /class="confidence-point" style="left:71%"/);
  assert.match(html, /0%<\/span><span>5%<\/span><span>10%/);
  assert.match(html, /7\.10%/);
  assert.match(html, /6\.27% to 7\.97%/);
  assert.match(html, /95% confidence interval/);
  assert.match(html, /PMC8870220/);
});
