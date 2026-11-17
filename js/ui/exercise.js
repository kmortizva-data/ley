// Exercise sheet: the app's own moving figure, the real photos and the technique cues.
import { EXERCISES, MUSCLES } from '../logic/program.js';
import { CUES } from '../logic/cues.js';
import { posesFor, figureOptions } from '../poses.js';
import { figureSvg, animateFigure } from '../figure.js';
import { esc } from './util.js';

// Exercises the camera can check today.
export const CAMERA_READY = new Set(['squat']);

export async function mount(root, ctx, id) {
  const ex = EXERCISES[id];
  if (!ex) return ctx.go('today');
  const poses = await posesFor(id).catch(() => null);
  const options = figureOptions(id, ex);
  const timed = ex.unit === 's';
  const rest = ex.rest >= 120 ? `${ex.rest / 60} min` : `${ex.rest} s`;

  root.innerHTML = `
  <section class="hero">
    <a class="link back" href="#today">Volver a Hoy</a>
    <p class="eyebrow">${esc(ex.primary.map((m) => MUSCLES[m]).join(' · '))}</p>
    <h1>${esc(ex.name)}</h1>
  </section>

  <article class="card demo">
    ${poses ? figureSvg(poses, 0, options) : '<p class="empty">Aún no hay figura para este ejercicio.</p>'}
    <div class="photos">
      <figure><img src="assets/photos/${esc(id)}_0.jpg" alt="Posición inicial de ${esc(ex.name)}" width="520" height="347"><figcaption>Inicio</figcaption></figure>
      <figure><img src="assets/photos/${esc(id)}_1.jpg" alt="Posición final de ${esc(ex.name)}" width="520" height="347"><figcaption>Final</figcaption></figure>
    </div>
    <p class="note">La figura es de la app: se dibuja con los puntos del cuerpo sacados de estas dos fotos. Fotos de free-exercise-db, dominio público.</p>
  </article>

  ${CAMERA_READY.has(id) ? `
  <article class="card">
    <h2>Revisa tu técnica</h2>
    <p class="note">La cámara cuenta tus repeticiones y mide qué tan abajo llegas. El video no se guarda ni sale del teléfono.</p>
    <a class="primary as-link" href="#technique/${esc(id)}">Abrir la cámara</a>
  </article>` : ''}

  <article class="card">
    <h2>Cómo hacerlo</h2>
    <ol class="steps cues">${(CUES[id] ?? []).map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
    <p class="note">Indicaciones prácticas de gimnasio, no salen de un estudio.</p>
  </article>

  <article class="card">
    <h2>En tu rutina</h2>
    <dl class="facts">
      <dt>${timed ? 'Tiempo por serie' : 'Repeticiones'}</dt><dd>${ex.reps[0]} a ${ex.reps[1]}${timed ? ' s' : ''}</dd>
      <dt>Descanso</dt><dd>${rest}</dd>
      <dt>También trabaja</dt><dd>${esc(ex.secondary.length ? ex.secondary.map((m) => MUSCLES[m]).join(', ') : 'nada más de forma notable')}</dd>
    </dl>
  </article>`;

  root.onclick = root.oninput = null;
  const svg = root.querySelector('svg.figure');
  return svg && poses ? animateFigure(svg, poses, options) : undefined;
}
