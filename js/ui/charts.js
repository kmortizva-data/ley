// Hand-written SVG line chart: no library, so it works offline and weighs nothing.
import { esc, tinyDate } from './util.js';

const W = 340;
const H = 220;
const PAD = { left: 46, right: 12, top: 12, bottom: 44 };

function niceStep(span, ticks) {
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

/**
 * @param {Array<{x:number,y:number}>} points x in ms, sorted ascending
 * @param {{yLabel:string, xLabel:string, trend?:(x:number)=>number}} options
 * @returns {string} SVG markup
 */
export function lineChart(points, { yLabel, xLabel, trend }) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs) === x0 ? x0 + 1 : Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMax === yMin) { yMin -= 1; yMax += 1; }
  const step = niceStep(yMax - yMin, 4);
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;

  const px = (x) => PAD.left + ((x - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const py = (y) => H - PAD.bottom - ((y - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const decimals = step < 1 ? 1 : 0;

  let grid = '';
  for (let y = yMin; y <= yMax + step / 2; y += step) {
    grid += `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${py(y)}" y2="${py(y)}"/>
      <text class="tick" x="${PAD.left - 6}" y="${py(y) + 4}" text-anchor="end">${y.toFixed(decimals)}</text>`;
  }
  const xTicks = points.length === 1 ? [x0] : [x0, (x0 + x1) / 2, x1];
  const xLabels = xTicks
    .map((x, i) => `<text class="tick" x="${px(x)}" y="${H - PAD.bottom + 16}" text-anchor="${i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}">${esc(tinyDate(x))}</text>`)
    .join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle class="dot" cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="3.2"/>`).join('');
  const trendLine = trend
    ? `<line class="trend" x1="${px(x0)}" y1="${py(trend(x0))}" x2="${px(x1)}" y2="${py(trend(x1))}"/>`
    : '';

  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} en el tiempo">
    ${grid}${xLabels}
    <clipPath id="plot"><rect x="${PAD.left}" y="${PAD.top}" width="${W - PAD.left - PAD.right}" height="${H - PAD.top - PAD.bottom}"/></clipPath>
    <g clip-path="url(#plot)">${trendLine}</g>
    <path class="line" d="${path}"/>${dots}
    <text class="axis" x="${(PAD.left + W - PAD.right) / 2}" y="${H - 6}" text-anchor="middle">${esc(xLabel)}</text>
    <text class="axis" transform="translate(12 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>
  </svg>`;
}
