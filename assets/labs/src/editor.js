// A small code editor for the Code tab: a textarea laid over a highlighted
// copy of the same text, in one scrolling box with line numbers. Light (no
// library), works offline, on phones (the system keyboard and selection) and
// with screen readers (it is a real textarea). Tab and Shift+Tab indent,
// Enter keeps the indent, a } on its own goes back a step; Esc then Tab
// leaves the box. Lines can be marked: 'cur' (where the caret is), 'err'
// (a compile error) and 'run' (where the running sketch is waiting).
//
//   const ed = codeEditor(parent, { file: 'blink.ino', text, onInput(text) {} });
//   ed.value; ed.set(text, file); ed.mark(12, 'err'); ed.clear('err'); ed.goto(12);
import { highlightCpp, icon } from './runtime.js';

const CSS = `
.lab-ed .ed-scroll { position: relative; display: flex; align-items: flex-start; overflow: auto; max-height: 360px; min-height: 160px; background: var(--lab-code-bg); font: 13px/20px var(--lab-mono); --ed-lh: 20px; overscroll-behavior: contain; }
.lab.lab-full .lab-ed .ed-scroll { max-height: min(62vh, 640px); }
.lab-ed .ed-gutter { position: sticky; left: 0; z-index: 2; flex: none; min-width: 3.3em; padding: 6px 0.8em 6px 0.3em; text-align: right; color: var(--lab-code-gutter); background: var(--lab-code-bg); border-right: 1px solid var(--lab-line); user-select: none; -webkit-user-select: none; white-space: pre; font-variant-numeric: tabular-nums; }
.lab-ed .ed-gutter span { display: block; height: var(--ed-lh); }
.lab-ed .ed-gutter span.err { color: var(--lab-accent); font-weight: 700; }
.lab-ed .ed-gutter span.run { color: var(--lab-gold-ink); font-weight: 700; }
.lab-ed .ed-area { position: relative; flex: 1 0 auto; min-width: calc(100% - 4.4em); }
.lab .lab-ed .ed-hl, .lab .lab-ed .ed-ta { margin: 0; padding: 6px 14px 6px 8px; border: 0; font: inherit; letter-spacing: 0; white-space: pre; tab-size: 2; -moz-tab-size: 2; word-wrap: normal; overflow-wrap: normal; }
.lab .lab-ed .ed-hl { position: relative; z-index: 1; pointer-events: none; color: var(--lab-code-ink); min-height: 100%; background: none; border-radius: 0; box-shadow: none; max-width: none; overflow: visible; }
.lab .lab-ed .ed-ta { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; resize: none; overflow: hidden; background: transparent; color: transparent; -webkit-text-fill-color: transparent; caret-color: var(--lab-code-ink); outline: none; }
.lab-ed .ed-ta::selection { background: rgba(255, 190, 0, 0.35); -webkit-text-fill-color: transparent; }
.lab-ed .ed-marks { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.lab-ed .ed-marks i { position: absolute; left: 0; right: 0; height: var(--ed-lh); border-left: 3px solid transparent; }
.lab-ed .ed-marks i.cur { background: rgba(128, 112, 140, 0.09); }
.lab-ed .ed-marks i.run { background: rgba(255, 190, 0, 0.2); border-left-color: var(--lab-gold); }
.lab-ed .ed-marks i.err { background: rgba(202, 31, 63, 0.15); border-left-color: var(--lab-accent); }
.lab-ed:focus-within { box-shadow: 0 0 0 3px rgba(255, 190, 0, 0.45); }
@media (pointer: coarse) { .lab-ed .ed-scroll { font-size: 16px; line-height: 24px; --ed-lh: 24px; } }
`;
let cssDone = false;
function addCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function codeEditor(parent, { file = 'sketch.ino', text = '', label = 'The sketch: edit it here', onInput } = {}) {
  addCss();
  const el = document.createElement('div');
  el.className = 'lab-code lab-ed';
  el.innerHTML = `<div class="lab-code-head"><span class="lab-code-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lab-code-file"></span><span class="lab-code-acts"></span></div>
<div class="ed-scroll"><div class="ed-gutter" aria-hidden="true"></div><div class="ed-area"><div class="ed-marks" aria-hidden="true"></div><pre class="ed-hl" aria-hidden="true"></pre><textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="${esc(label)}" aria-describedby=""></textarea></div></div>`;
  const fileEl = el.querySelector('.lab-code-file');
  const acts = el.querySelector('.lab-code-acts');
  const scroll = el.querySelector('.ed-scroll');
  const gutter = el.querySelector('.ed-gutter');
  const marksEl = el.querySelector('.ed-marks');
  const hl = el.querySelector('.ed-hl');
  const ta = el.querySelector('.ed-ta');
  const marks = { cur: 0, err: 0, run: 0 };
  let lines = 0;
  let escaped = false;

  const lh = () => parseFloat(getComputedStyle(scroll).getPropertyValue('--ed-lh')) || 20;
  function render() {
    const v = ta.value;
    hl.innerHTML = highlightCpp(v) + (v.endsWith('\n') || !v ? ' ' : '') + '\n';
    const n = v.split('\n').length;
    if (n !== lines) {
      lines = n;
      gutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join('');
    }
    paintMarks();
  }
  function paintMarks() {
    const h = lh();
    marksEl.innerHTML = ['cur', 'run', 'err'].filter((k) => marks[k] > 0 && marks[k] <= lines).map((k) => `<i class="${k}" style="top:${6 + (marks[k] - 1) * h}px"></i>`).join('');
    gutter.querySelectorAll('span.err, span.run').forEach((s) => (s.className = ''));
    for (const k of ['run', 'err']) if (marks[k] > 0) gutter.children[marks[k] - 1]?.classList.add(k);
  }
  const lineAt = (pos) => ta.value.slice(0, pos).split('\n').length;
  function caretLine() {
    const n = lineAt(ta.selectionStart);
    if (n !== marks.cur) { marks.cur = n; paintMarks(); }
  }
  let saveT = 0;
  function changed() {
    render();
    caretLine();
    clearTimeout(saveT);
    saveT = setTimeout(() => onInput?.(ta.value), 250);
  }
  function insert(str, from = ta.selectionStart, to = ta.selectionEnd) {
    ta.focus();
    ta.setSelectionRange(from, to);
    // insertText keeps the browser's own undo (Ctrl+Z) working
    let done = false;
    try { done = document.execCommand('insertText', false, str); } catch {}
    if (!done || ta.value.slice(from, from + str.length) !== str) {
      ta.setRangeText(str, from, to, 'end');
      changed();
    }
  }
  ta.addEventListener('input', changed);
  ta.addEventListener('keyup', caretLine);
  ta.addEventListener('click', caretLine);
  ta.addEventListener('focus', caretLine);
  ta.addEventListener('blur', () => { marks.cur = 0; paintMarks(); });
  document.addEventListener('selectionchange', () => { if (document.activeElement === ta) caretLine(); });
  ta.addEventListener('keydown', (e) => {
    const v = ta.value;
    const s = ta.selectionStart, en = ta.selectionEnd;
    if (e.key === 'Escape') { escaped = true; return; }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (escaped) { escaped = false; return; } // let Tab leave the box
      e.preventDefault();
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s === en && !e.shiftKey) { insert('  '); return; }
      // indent or outdent every selected line
      const le = en > s && v[en - 1] === '\n' ? en - 1 : en;
      const block = v.slice(ls, le);
      const out = block.split('\n').map((l) => (e.shiftKey ? l.replace(/^ {1,2}|^\t/, '') : '  ' + l)).join('\n');
      insert(out, ls, le);
      ta.setSelectionRange(ls, ls + out.length);
      return;
    }
    escaped = false;
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing) {
      e.preventDefault();
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const indent = /^[ \t]*/.exec(v.slice(ls, s))[0];
      const before = v.slice(ls, s).trimEnd();
      const after = v.slice(en, v.indexOf('\n', en) < 0 ? v.length : v.indexOf('\n', en)).trimStart();
      if (before.endsWith('{') && after.startsWith('}')) {
        insert('\n' + indent + '  ' + '\n' + indent);
        const p = s + 1 + indent.length + 2;
        ta.setSelectionRange(p, p);
      } else insert('\n' + indent + (before.endsWith('{') ? '  ' : ''));
      return;
    }
    if (e.key === '}' && !e.ctrlKey && !e.metaKey && s === en) {
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const head = v.slice(ls, s);
      if (/^ {2,}$/.test(head)) { e.preventDefault(); insert(head.slice(2) + '}', ls, s); }
    }
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'lab-code-btn';
  copyBtn.innerHTML = `${icon('copy')}<span>Copy</span>`;
  copyBtn.setAttribute('aria-label', 'Copy the code');
  copyBtn.addEventListener('click', async () => {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(ta.value); ok = true; } } catch {}
    if (!ok) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch {} }
    copyBtn.innerHTML = ok ? `${icon('check')}<span>Copied</span>` : `${icon('copy')}<span>Select and copy</span>`;
    setTimeout(() => { copyBtn.innerHTML = `${icon('copy')}<span>Copy</span>`; }, 1800);
  });
  acts.appendChild(copyBtn);
  parent.appendChild(el);

  const api = {
    el,
    textarea: ta,
    get value() { return ta.value; },
    set(t, f) {
      if (f) fileEl.textContent = f;
      ta.value = t;
      marks.err = 0; marks.run = 0;
      render();
    },
    file(f) { fileEl.textContent = f; },
    mark(n, cls) { marks[cls] = n || 0; paintMarks(); if (n && cls === 'err') api.reveal(n); },
    clear(cls) { marks[cls] = 0; paintMarks(); },
    // scroll a line into view (without moving the caret)
    reveal(n) {
      const h = lh();
      const top = 6 + (n - 1) * h;
      if (top < scroll.scrollTop || top + h > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = Math.max(0, top - scroll.clientHeight / 3);
    },
    // put the caret at the start of a line's text
    goto(n) {
      const ls = ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < n - 1 && i < ls.length; i++) pos += ls[i].length + 1;
      pos += /^\s*/.exec(ls[n - 1] || '')[0].length;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(pos, pos);
      api.reveal(n);
      caretLine();
      marksEl.querySelector('i.cur')?.scrollIntoView({ block: 'nearest' });
    },
    describedBy(id) { ta.setAttribute('aria-describedby', id); },
  };
  api.set(text, file);
  return api;
}
