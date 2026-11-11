'use strict';
// Keep or drop whole temporal test windows, shown as looping videos (windows/<id>.mp4, listed in windows.json).
const $ = (id) => document.getElementById(id);
let STORE = 'stopline-windows-v1'; // per split: test decisions and training decisions never mix
let split = 'test';
const video = $('video');
let list = [];      // [{id, kind, frames, line, unknown}]
let session = null; // {started, decisions: {id: {keep, t}}}
let index = 0;
let slow = false;
const ahead = document.createElement('video'); // preloads the next window
ahead.muted = true; ahead.preload = 'auto';

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.decisions) return s;
  } catch (e) { /* none yet */ }
  return { started: new Date().toISOString(), decisions: {} };
}
function saveSession() {
  try { localStorage.setItem(STORE, JSON.stringify(session)); } catch (e) { /* in memory only */ }
}
const src = (i) => `windows/${list[i].id}.mp4`;

function open(i) {
  if (!list.length) return;
  index = (i + list.length) % list.length;
  video.src = src(index);
  video.playbackRate = slow ? 0.5 : 1;
  video.play().catch(() => {});
  $('pauseBtn').textContent = '❚❚';
  const n = nextUndecided(index + 1);
  if (n >= 0) { ahead.src = src(n); ahead.load(); }
  updateUI();
}
function nextUndecided(from) {
  for (let k = 0; k < list.length; k++) {
    const i = (from + k) % list.length;
    if (!session.decisions[list[i].id]) return i;
  }
  return -1;
}
function decide(keep) {
  session.decisions[list[index].id] = { keep, t: new Date().toISOString() };
  saveSession();
  const n = nextUndecided(index + 1);
  if (n < 0) { updateUI(); $('empty').hidden = false; return; }
  open(n);
}
function updateUI() {
  const done = list.filter((w) => session.decisions[w.id]).length;
  const kept = list.filter((w) => session.decisions[w.id] && session.decisions[w.id].keep).length;
  $('progress').textContent = `Window ${index + 1} of ${list.length} · ${done} decided (${kept} kept, ${done - kept} dropped)`;
  const w = list[index];
  $('winId').textContent = w ? `${w.id} · ${w.kind}` : '';
  const d = w && session.decisions[w.id];
  $('badge').textContent = d ? (d.keep ? 'kept' : 'dropped') : '';
  $('badge').className = d ? (d.keep ? 'kept' : 'dropped') : '';
  $('keepBtn').classList.toggle('on', !!(d && d.keep));
  $('dropBtn').classList.toggle('on', !!(d && !d.keep));
  $('slowBtn').classList.toggle('on', slow);
  $('downloadBtn').disabled = !done;
  if (nextUndecided(0) >= 0) $('empty').hidden = true;
}
function download() {
  const out = {
    kind: 'windows', split, session_started: session.started, downloaded: new Date().toISOString(),
    decisions: session.decisions,
  };
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `windows-${split}-${session.started.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function togglePause() {
  if (video.paused) { video.play().catch(() => {}); $('pauseBtn').textContent = '❚❚'; }
  else { video.pause(); $('pauseBtn').textContent = '▶︎'; }
}
function toggleSlow() { slow = !slow; video.playbackRate = slow ? 0.5 : 1; updateUI(); }

$('keepBtn').onclick = () => decide(true);
$('dropBtn').onclick = () => decide(false);
$('prevBtn').onclick = () => open(index - 1);
$('fwdBtn').onclick = () => open(index + 1);
$('pauseBtn').onclick = togglePause;
$('slowBtn').onclick = toggleSlow;
$('downloadBtn').onclick = download;
$('helpBtn').onclick = () => {
  const n = Object.keys(session.decisions).length;
  $('sessionInfo').textContent = `This session: ${n} window${n === 1 ? '' : 's'} decided since ${new Date(session.started).toLocaleString()}.`;
  $('help').showModal();
};
$('closeHelp').onclick = () => $('help').close();
$('clearBtn').onclick = () => {
  const n = Object.keys(session.decisions).length;
  if (n && !confirm(`Discard the ${n} decision${n === 1 ? '' : 's'} in this browser? Download them first if you haven't.`)) return;
  session = { started: new Date().toISOString(), decisions: {} };
  saveSession(); $('help').close(); open(0);
};
document.addEventListener('keydown', (e) => {
  if ($('help').open) return;
  const k = e.key.toLowerCase();
  if (k === 'k') decide(true);
  else if (k === 'd') decide(false);
  else if (k === 'arrowleft') open(index - 1);
  else if (k === 'arrowright') open(index + 1);
  else if (k === 's') toggleSlow();
  else if (k === ' ') { e.preventDefault(); togglePause(); }
  else return;
});

(async function main() {
  list = (await (await fetch('windows.json', { cache: 'no-cache' })).json()).windows;
  split = (list[0] && list[0].split) || 'test';
  if (split !== 'test') STORE = `stopline-windows-${split}-v2`;
  session = loadSession();
  $('winHelp').textContent = split === 'test' ? 'about two seconds of driving (41 frames at 20 fps)'
    : 'about two seconds of driving (every second frame, 21 frames, played at 10 fps: real time)';
  const listed = new Set(list.map((w) => w.id));
  for (const id of Object.keys(session.decisions)) if (!listed.has(id)) delete session.decisions[id];
  saveSession();
  const n = nextUndecided(0);
  open(n < 0 ? 0 : n);
  if (n < 0) $('empty').hidden = false;
  try { if (!localStorage.getItem('stopline-windows-helped')) { localStorage.setItem('stopline-windows-helped', '1'); $('helpBtn').click(); } } catch (e) { /* fine */ }
})();
