// "Ajustes": load increments, backup, the science behind each rule and data reset.
import * as db from '../db.js';
import { DEFAULT_INCREMENTS, GEAR_LABELS } from '../logic/program.js';
import { EVIDENCE } from '../evidence.js';
import { esc, num, kg, todayIso, confirmTap } from './util.js';

export async function mount(root, ctx) {
  const increments = { ...DEFAULT_INCREMENTS, ...(await db.getValue('increments', {})) };

  root.innerHTML = `
  <section class="hero"><p class="eyebrow">Ajustes</p><h1>Tu gimnasio, tus datos</h1></section>

  <article class="card"><h2>Salto de peso</h2>
    <p class="note">El salto más pequeño que puedes dar en tu gimnasio. La app lo usa cuando te toca subir.</p>
    <div class="incs">
      ${Object.entries(GEAR_LABELS).map(([gear, label]) => `
      <label class="inc"><span>${esc(label)}</span>
        <span class="field"><input data-gear="${gear}" inputmode="decimal" value="${kg(increments[gear])}" aria-label="Salto para ${esc(label)}"><span>kg</span></span></label>`).join('')}
    </div>
  </article>

  <article class="card"><h2>Respaldo</h2>
    <p class="note">Tu historial vive solo en este teléfono. Si borras los datos del navegador, se pierde. Guarda un respaldo de vez en cuando.</p>
    <div class="row">
      <button class="primary" data-act="export">Guardar respaldo</button>
      <label class="ghost">Cargar respaldo<input type="file" accept="application/json,.json" data-import hidden></label>
    </div>
  </article>

  <article class="card"><h2>La ciencia detrás</h2>
    <p class="note">Cada regla de la app y el estudio que la respalda, con lo que el estudio no alcanza a cubrir.</p>
    ${EVIDENCE.map((e) => `
    <details class="ev">
      <summary>${esc(e.rule)}</summary>
      <p>${esc(e.source)}</p>
      <p class="caveat">${esc(e.caveat)}</p>
      <a href="https://doi.org/${esc(e.doi)}" target="_blank" rel="noopener">doi.org/${esc(e.doi)}</a>
    </details>`).join('')}
  </article>

  <article class="card"><h2>Créditos</h2>
    <p class="note">Reconocimiento del cuerpo: MediaPipe Pose Landmarker, de Google, con licencia Apache 2.0. Corre dentro del teléfono.</p>
    <p class="note">Maniquí 3D: cuerpo de Quaternius (Universal Base Characters), de dominio público, dibujado con three.js (licencia MIT). Las posturas, el movimiento y los músculos en rojo son de la app.</p>
    <p class="note">Fotos de los ejercicios: free-exercise-db, de dominio público.</p>
    <p class="note"><a class="link" href="lab/pose.html">Laboratorio de cámara</a> para medir la velocidad de tu teléfono.</p>
  </article>

  <article class="card"><h2>Zona de riesgo</h2>
    <button class="link danger" data-act="wipe">Borrar todos mis datos</button>
  </article>
  <p class="disclaimer">Ley, versión 0.3. Pautas generales basadas en estudios, no un plan médico.</p>`;

  root.onsubmit = null;
  root.oninput = async (e) => {
    const gear = e.target.dataset.gear;
    if (gear) {
      const value = num(e.target.value);
      if (value > 0 && value <= 20) {
        increments[gear] = value;
        await db.setValue('increments', increments);
      }
    }
  };

  root.onchange = async (e) => {
    if (!e.target.matches('[data-import]') || !e.target.files[0]) return;
    try {
      await db.importAll(JSON.parse(await e.target.files[0].text()));
      ctx.toast('Respaldo cargado.');
      ctx.go('history');
    } catch {
      ctx.toast('Ese archivo no es un respaldo de Ley.');
    }
  };

  root.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') {
      const blob = new Blob([JSON.stringify(await db.exportAll(), null, 1)], { type: 'application/json' });
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ley-respaldo-${todayIso()}.json` });
      link.click();
      URL.revokeObjectURL(link.href);
      ctx.toast('Respaldo guardado en Descargas.');
    } else if (act === 'wipe') {
      if (!confirmTap(e.target.closest('button'), 'Toca otra vez: se borra todo')) return;
      await db.wipe();
      ctx.toast('Datos borrados.');
      ctx.go('today');
    }
  };
}
