/* ══════════════════════════════════════════════
   GradeFlow — app.js
   Universal student tracker. No dependencies.
══════════════════════════════════════════════ */

'use strict';

/* ─── DEFAULT SUBJECTS (NUTECH CS Spring 2026) ─── */
const DEFAULT_SUBJECTS = [
  { id: 'GE121', code: 'GE121', name: 'Calculus & Analytical Geometry', credits: 3 },
  { id: 'CS160', code: 'CS160', name: 'Database Systems',               credits: 3 },
  { id: 'CS161', code: 'CS161', name: 'Database Systems Lab',           credits: 1 },
  { id: 'CS122', code: 'CS122', name: 'Object Oriented Programming',    credits: 3 },
  { id: 'CS123', code: 'CS123', name: 'OOP Lab',                        credits: 1 },
  { id: 'CS130', code: 'CS130', name: 'Digital Logic Design',           credits: 2 },
  { id: 'CS131', code: 'CS131', name: 'Digital Logic Design Lab',       credits: 1 },
  { id: 'MT220', code: 'MT220', name: 'Probability & Statistics',       credits: 3 },
  { id: 'GE231', code: 'GE231', name: 'Fehm-e-Quran I',                credits: 1 },
];

/* ─── GPA SCALE ─── */
const GPA_SCALE = [
  { min: 90, grade: 'A',  points: 4.0 },
  { min: 85, grade: 'A-', points: 3.7 },
  { min: 80, grade: 'B+', points: 3.3 },
  { min: 75, grade: 'B',  points: 3.0 },
  { min: 70, grade: 'B-', points: 2.7 },
  { min: 65, grade: 'C+', points: 2.3 },
  { min: 60, grade: 'C',  points: 2.0 },
  { min: 55, grade: 'C-', points: 1.7 },
  { min: 50, grade: 'D+', points: 1.3 },
  { min: 45, grade: 'D',  points: 1.0 },
  { min:  0, grade: 'F',  points: 0.0 },
];

const STORAGE_KEY = 'gradeflow_v2';

/* ─── RUNTIME SUBJECTS (loaded from DATA) ─── */
let SUBJECTS = [];

/* ─── DEFAULT DATA PER SUBJECT ─── */
function defaultSubjectData() {
  return {
    marks: {
      quizzes:     [null, null, null, null, null, null],
      assignments: [null, null, null, null, null, null],
      pbl:         null,
      mid:         null,
      finalObt:    null,
      finalTotal:  null,
    },
    attendance: { present: 0, absent: 0, late: 0 },
  };
}

/* ─── LOAD / SAVE ─── */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed._meta || !parsed._subjects) return null;
    return parsed;
  } catch { return null; }
}

function initData(subjects, meta = {}) {
  const data = {
    _meta: { lastUpdated: null, theme: 'light', name: '', uni: '', semester: '', ...meta },
    _subjects: subjects,
  };
  subjects.forEach(sub => { data[sub.id] = defaultSubjectData(); });
  return data;
}

function saveData() {
  DATA._meta.lastUpdated = new Date().toISOString();
  markDirty();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
  } catch {
    showToast('⚠️ Storage full — data may not save');
  }
  updateLastUpdatedLabel();
}

/* ─── GRADE HELPERS ─── */
function pctToGrade(pct) {
  if (pct == null || isNaN(pct)) return { grade: '—', points: null };
  for (const g of GPA_SCALE) {
    if (pct >= g.min) return g;
  }
  return GPA_SCALE[GPA_SCALE.length - 1];
}

function gradeColor(pct) {
  if (pct == null || isNaN(pct)) return '';
  if (pct >= 75) return 'green';
  if (pct >= 60) return 'amber';
  return 'red';
}

function badgeClass(pct) {
  if (pct == null || isNaN(pct)) return 'badge-grade';
  if (pct >= 75) return 'badge-green';
  if (pct >= 60) return 'badge-amber';
  return 'badge-red';
}

function attBadgeClass(pct) {
  if (pct == null || isNaN(pct)) return 'badge-grade';
  if (pct >= 75) return 'badge-green';
  if (pct >= 65) return 'badge-amber';
  return 'badge-red';
}

/* ─── MARKS CALCULATION ─── */
function calcSubjectPct(marks) {
  let weightedSum = 0, weightTotal = 0;

  const quizVals = marks.quizzes.filter(v => v !== null && v !== '' && !isNaN(v));
  if (quizVals.length > 0) {
    weightedSum += (quizVals.reduce((a, b) => a + Number(b), 0) / (quizVals.length * 10)) * 15;
    weightTotal += 15;
  }

  const assVals = marks.assignments.filter(v => v !== null && v !== '' && !isNaN(v));
  if (assVals.length > 0) {
    weightedSum += (assVals.reduce((a, b) => a + Number(b), 0) / (assVals.length * 10)) * 10;
    weightTotal += 10;
  }

  if (marks.pbl !== null && marks.pbl !== '' && !isNaN(marks.pbl)) {
    weightedSum += (Number(marks.pbl) / 10) * 5;
    weightTotal += 5;
  }

  if (marks.mid !== null && marks.mid !== '' && !isNaN(marks.mid)) {
    weightedSum += (Number(marks.mid) / 25) * 25;
    weightTotal += 25;
  }

  const fObt = Number(marks.finalObt), fTotal = Number(marks.finalTotal);
  if (marks.finalObt !== null && marks.finalTotal !== null &&
      marks.finalObt !== '' && marks.finalTotal !== '' &&
      !isNaN(fObt) && !isNaN(fTotal) && fTotal > 0) {
    weightedSum += (fObt / fTotal) * 45;
    weightTotal += 45;
  }

  if (weightTotal === 0) return null;
  return (weightedSum / weightTotal) * 100;
}

/* ─── ATTENDANCE ─── */
function calcAttPctStrict(att) {
  const total = att.present + att.absent + att.late;
  if (total === 0) return null;
  return (att.present / total) * 100;
}

/* ─── GPA ─── */
function calcGPA() {
  let totalPoints = 0, totalCredits = 0;
  SUBJECTS.forEach(sub => {
    const pct = calcSubjectPct(DATA[sub.id].marks);
    if (pct !== null) {
      const g = pctToGrade(pct);
      totalPoints  += g.points * sub.credits;
      totalCredits += sub.credits;
    }
  });
  if (totalCredits === 0) return null;
  return totalPoints / totalCredits;
}

function calcOverallAtt() {
  let totalPresent = 0, totalClasses = 0;
  SUBJECTS.forEach(sub => {
    const att = DATA[sub.id].attendance;
    totalPresent += att.present;
    totalClasses += att.present + att.absent + att.late;
  });
  if (totalClasses === 0) return null;
  return (totalPresent / totalClasses) * 100;
}

function totalCredits() {
  return SUBJECTS.reduce((s, sub) => s + sub.credits, 0);
}

/* ─── TOAST ─── */
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), duration);
}

/* ─── LAST UPDATED ─── */
function updateLastUpdatedLabel() {
  const el = document.getElementById('last-updated-label');
  if (!el) return;
  const ts = DATA._meta.lastUpdated;
  if (!ts) { el.textContent = 'No data saved yet'; return; }
  const d = new Date(ts);
  el.textContent = `Last saved: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function updateNavLabel() {
  const el = document.getElementById('nav-semester-label');
  if (!el) return;
  const sem = DATA._meta.semester || '';
  const uni = DATA._meta.uni || '';
  el.textContent = [uni, sem].filter(Boolean).join(' · ') || 'Student Tracker';
}

/* ─── THEME ─── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  DATA._meta.theme = theme;
}

/* ══════════════════════════════════════════════
   SETUP WIZARD
══════════════════════════════════════════════ */
let _wizardSetupDone = false;

function showSetup() {
  document.getElementById('setup-overlay').classList.remove('hidden');
  buildCustomSubjectRows(3);
}

function hideSetup() {
  document.getElementById('setup-overlay').classList.add('hidden');
}

function showStep(n) {
  document.querySelectorAll('.setup-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
}

function buildCustomSubjectRows(count = 1) {
  const list = document.getElementById('custom-subjects-list');
  list.innerHTML = '';
  for (let i = 0; i < count; i++) addCustomSubjectRow();
}

function addCustomSubjectRow() {
  const list = document.getElementById('custom-subjects-list');
  const row  = document.createElement('div');
  row.className = 'custom-subject-row';
  row.innerHTML = `
    <input type="text"   class="csr-code"    placeholder="Code"    maxlength="8" />
    <input type="text"   class="csr-name"    placeholder="Subject Name" />
    <input type="number" class="csr-credits" placeholder="Cr." min="1" max="6" value="3" />
    <button class="btn-remove-row" title="Remove">×</button>
  `;
  row.querySelector('.btn-remove-row').addEventListener('click', () => {
    if (document.querySelectorAll('.custom-subject-row').length > 1) {
      row.remove();
    } else {
      showToast('⚠️ You need at least one subject!');
    }
  });
  list.appendChild(row);
}

function collectCustomSubjects() {
  const rows = document.querySelectorAll('.custom-subject-row');
  const subjects = [];
  let valid = true;
  rows.forEach((row, i) => {
    const code    = row.querySelector('.csr-code').value.trim().toUpperCase();
    const name    = row.querySelector('.csr-name').value.trim();
    const credits = parseInt(row.querySelector('.csr-credits').value) || 3;
    if (!code || !name) { valid = false; return; }
    const id = code + '_' + i;
    subjects.push({ id, code, name, credits });
  });
  return valid ? subjects : null;
}

function setupWizard() {
  if (_wizardSetupDone) return;
  _wizardSetupDone = true;

  // Step 1 → 2 (with validation)
  document.getElementById('step1-next').addEventListener('click', () => {
    const uni = document.getElementById('setup-uni').value.trim();
    const sem = document.getElementById('setup-sem').value.trim();
    if (!uni) { showToast('⚠️ Please enter your university name.'); return; }
    if (!sem) { showToast('⚠️ Please enter your semester.'); return; }
    showStep(2);
  });

  // Choice: default
  document.getElementById('choice-default').addEventListener('click', () => {
    const meta = {
      name:     document.getElementById('setup-name').value.trim(),
      uni:      document.getElementById('setup-uni').value.trim() || 'My University',
      semester: document.getElementById('setup-sem').value.trim() || 'Current Semester',
      theme:    'light',
    };
    DATA = initData(DEFAULT_SUBJECTS, meta);
    SUBJECTS = DATA._subjects;
    saveData();
    hideSetup();
    applyTheme('light');
    updateNavLabel();
    renderAll();
    showToast('🎉 Welcome! Default subjects loaded.');
  });

  // Choice: custom → step 3
  document.getElementById('choice-custom').addEventListener('click', () => showStep(3));

  // Step 3: add row
  document.getElementById('btn-add-subject-row').addEventListener('click', addCustomSubjectRow);

  // Step 3: back
  document.getElementById('step3-back').addEventListener('click', () => showStep(2));

  // Step 3: done
  document.getElementById('step3-done').addEventListener('click', () => {
    const subjects = collectCustomSubjects();
    if (!subjects || subjects.length === 0) {
      showToast('⚠️ Please fill in at least one subject with a code and name.');
      return;
    }
    const meta = {
      name:     document.getElementById('setup-name').value.trim(),
      uni:      document.getElementById('setup-uni').value.trim() || 'My University',
      semester: document.getElementById('setup-sem').value.trim() || 'Current Semester',
      theme:    'light',
    };
    DATA = initData(subjects, meta);
    SUBJECTS = DATA._subjects;
    saveData();
    hideSetup();
    applyTheme('light');
    updateNavLabel();
    renderAll();
    showToast('🚀 All set! Start entering your data.');
  });
}

/* ══════════════════════════════════════════════
   CARD TOGGLE
══════════════════════════════════════════════ */
function attachCardToggle(card) {
  const header = card.querySelector('.card-header');
  header.addEventListener('click', () => toggleCard(card));
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(card); }
  });
}

function toggleCard(card) {
  const isOpen = card.classList.toggle('open');
  card.querySelector('.card-header').setAttribute('aria-expanded', isOpen);
}

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      if (page === 'analyze')   renderAnalyze();
      if (page === 'dashboard' && _dirty) { renderDashboard(); updateDashboardStats(); _dirty = false; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ══════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════ */
function setupTheme() {
  applyTheme(DATA._meta.theme || 'light');
  document.getElementById('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveData();
    showToast(next === 'dark' ? '🌙 Dark mode on' : '☀️ Light mode on');
  });
}

/* ══════════════════════════════════════════════
   EXCEL EXPORT (XLSX)
   Builds a styled .xlsx using the Office Open XML
   format with two sheets: Summary + Raw Data.
══════════════════════════════════════════════ */
function exportAsXLSX() {
  // We build a proper multi-sheet XLSX from scratch using XML + ZIP.
  // Colors: dark blue header, alternating rows, conditional grade colors.

  const subjects = SUBJECTS;
  const now      = new Date();
  const dateStr  = now.toLocaleDateString();
  const uni      = DATA._meta.uni      || 'My University';
  const sem      = DATA._meta.semester || 'Current Semester';
  const name     = DATA._meta.name     || '';

  // ── shared helpers ──
  const safe = v => (v === null || v === undefined || v === '') ? '' : String(v);
  const num  = v => (v === null || v === undefined || v === '') ? null : Number(v);

  // ── build row data ──
  const rows = subjects.map(sub => {
    const d      = DATA[sub.id];
    const m      = d.marks;
    const att    = d.attendance;
    const pct    = calcSubjectPct(m);
    const attPct = calcAttPctStrict(att);
    const g      = pctToGrade(pct);
    return {
      code: sub.code, name: sub.name, credits: sub.credits,
      q: m.quizzes.map(v => num(v)),
      a: m.assignments.map(v => num(v)),
      pbl: num(m.pbl), mid: num(m.mid),
      finalObt: num(m.finalObt), finalTotal: num(m.finalTotal),
      marksPct: pct !== null ? parseFloat(pct.toFixed(2)) : null,
      grade: pct !== null ? g.grade : '-',
      present: att.present, absent: att.absent, late: att.late,
      attPct: attPct !== null ? parseFloat(attPct.toFixed(2)) : null,
    };
  });

  const gpa = calcGPA();

  // ── XML builders ──
  function xmlEscape(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Shared strings table
  const strings = [];
  const strIdx  = {};
  function ss(v) {
    const k = String(v);
    if (strIdx[k] === undefined) { strIdx[k] = strings.length; strings.push(k); }
    return strIdx[k];
  }

  // Pre-register all strings
  const headers1 = ['Code','Subject','Credits','Q1','Q2','Q3','Q4','Q5','Q6','A1','A2','A3','A4','A5','A6','PBL','Mid (/25)','Final Obtained','Final Total','Marks %','Grade','Present','Absent','Late','Attendance %'];
  headers1.forEach(ss);
  rows.forEach(r => { ss(r.code); ss(r.name); ss(r.grade); });
  [uni, sem, name || 'Student', 'GradeFlow Export', dateStr, 'GPA', 'Subjects', 'Credits', 'Attendance'].forEach(ss);
  ['A (≥90%)','A- (≥85%)','B+ (≥80%)','B (≥75%)','B- (≥70%)','C+ (≥65%)','C (≥60%)','C- (≥55%)','D+ (≥50%)','D (≥45%)','F (<45%)'].forEach(ss);

  // ── Cell format IDs ──
  // numFmtId: 0=General, 2=0.00, 9=0%, 164=custom
  // We'll define xf indices:
  // 0 = default, 1 = header, 2 = subheader, 3 = number 0.00, 4 = percent, 5 = alt row, 6 = grade-green, 7 = grade-amber, 8 = grade-red, 9 = bold center, 10 = meta

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><sz val="11"/><b/><color rgb="FF0F1E2E"/><name val="Arial"/></font>
    <font><sz val="13"/><b/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><sz val="10"/><color rgb="FF4A5F73"/><name val="Arial"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF3"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF9C4"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="left"   vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0"   fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="2" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2"   fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2"   fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="0" fillId="3" borderId="1" xfId="0"><alignment horizontal="left"   vertical="center"/></xf>
    <xf numFmtId="0"   fontId="2" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="2" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3" fillId="2" borderId="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4" fillId="0" borderId="0" xfId="0"><alignment horizontal="left"   vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

  // ── sheet 1: Marks & Data ──
  function col(n) {
    // convert 1-based col number to letter(s)
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function cellRef(r, c) { return col(c) + r; }

  function sCell(r, c, si, style) {
    return `<c r="${cellRef(r,c)}" t="s" s="${style}"><v>${si}</v></c>`;
  }
  function nCell(r, c, val, style, fmt) {
    if (val === null || val === undefined || val === '') return `<c r="${cellRef(r,c)}" s="${style}"/>`;
    return `<c r="${cellRef(r,c)}" s="${style}"><v>${val}</v></c>`;
  }

  // Sheet 1: Raw Data
  let s1rows = '';
  // Row 1: title
  s1rows += `<row r="1" ht="28" customHeight="1"><c r="A1" t="s" s="9"><v>${ss('GradeFlow Export')}</v></c></row>`;
  // Row 2: meta
  s1rows += `<row r="2" ht="16"><c r="A2" t="s" s="10"><v>${ss(uni + ' · ' + sem + (name ? ' · ' + name : '') + '   Exported: ' + dateStr)}</v></c></row>`;
  // Row 3: blank
  s1rows += `<row r="3"/>`;
  // Row 4: headers
  let hrow = `<row r="4" ht="20">`;
  headers1.forEach((h, i) => { hrow += sCell(4, i+1, ss(h), 1); });
  hrow += `</row>`;
  s1rows += hrow;

  // Data rows
  rows.forEach((r, ri) => {
    const rowNum = ri + 5;
    const altFill = ri % 2 === 1 ? 5 : 0; // alt row style
    const baseStyle = altFill === 5 ? 5 : 0;
    const numStyle  = 3;
    let drow = `<row r="${rowNum}" ht="18">`;
    drow += sCell(rowNum, 1, ss(r.code),    1 );  // code - header style (blue bg) repurposed; use center
    drow += sCell(rowNum, 2, ss(r.name),    baseStyle);
    drow += nCell(rowNum, 3, r.credits,     8);
    r.q.forEach((v,i)  => { drow += nCell(rowNum, 4+i,  v, numStyle); });
    r.a.forEach((v,i)  => { drow += nCell(rowNum, 10+i, v, numStyle); });
    drow += nCell(rowNum, 16, r.pbl,         numStyle);
    drow += nCell(rowNum, 17, r.mid,         numStyle);
    drow += nCell(rowNum, 18, r.finalObt,    numStyle);
    drow += nCell(rowNum, 19, r.finalTotal,  numStyle);
    drow += nCell(rowNum, 20, r.marksPct,    3);
    // Grade cell: green if ≥75, amber 60–74, red <60
    const gradeStyle = r.marksPct !== null ? (r.marksPct >= 75 ? 6 : r.marksPct >= 60 ? 7 : 8) : 2;
    drow += sCell(rowNum, 21, ss(r.grade),  gradeStyle);
    drow += nCell(rowNum, 22, r.present,    numStyle);
    drow += nCell(rowNum, 23, r.absent,     numStyle);
    drow += nCell(rowNum, 24, r.late,       numStyle);
    drow += nCell(rowNum, 25, r.attPct,     3);
    drow += `</row>`;
    s1rows += drow;
  });

  const totalRow = rows.length + 5;
  // Totals row
  s1rows += `<row r="${totalRow}" ht="18">`;
  s1rows += sCell(totalRow, 2, ss('TOTAL / AVERAGE'), 1);
  s1rows += nCell(totalRow, 3, subjects.reduce((a,s)=>a+s.credits,0), 1);
  if (rows.some(r => r.marksPct !== null)) {
    const avg = rows.filter(r => r.marksPct !== null).reduce((a,r)=>a+r.marksPct,0) / rows.filter(r=>r.marksPct!==null).length;
    s1rows += nCell(totalRow, 20, parseFloat(avg.toFixed(2)), 1);
  }
  if (gpa !== null) s1rows += nCell(totalRow, 21, parseFloat(gpa.toFixed(2)), 1);
  const totalPres = rows.reduce((a,r)=>a+r.present,0);
  const totalAbs  = rows.reduce((a,r)=>a+r.absent,0);
  const totalLate = rows.reduce((a,r)=>a+r.late,0);
  s1rows += nCell(totalRow, 22, totalPres, 1);
  s1rows += nCell(totalRow, 23, totalAbs,  1);
  s1rows += nCell(totalRow, 24, totalLate, 1);
  const totClasses = totalPres+totalAbs+totalLate;
  if (totClasses>0) s1rows += nCell(totalRow, 25, parseFloat((totalPres/totClasses*100).toFixed(2)), 1);
  s1rows += `</row>`;

  // col widths
  const colWidths = [
    {min:1,max:1,w:10},{min:2,max:2,w:28},{min:3,max:3,w:9},
    {min:4,max:9,w:7},{min:10,max:15,w:7},
    {min:16,max:16,w:7},{min:17,max:17,w:9},{min:18,max:19,w:10},
    {min:20,max:20,w:10},{min:21,max:21,w:10},
    {min:22,max:24,w:9},{min:25,max:25,w:12}
  ];
  const colsXml = colWidths.map(c=>`<col min="${c.min}" max="${c.max}" width="${c.w}" customWidth="1"/>`).join('');

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>${s1rows}</sheetData>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

  // ── Sheet 2: Summary ──
  const gpaScale = [
    ['A','≥90%','4.0'],['A-','≥85%','3.7'],['B+','≥80%','3.3'],
    ['B','≥75%','3.0'],['B-','≥70%','2.7'],['C+','≥65%','2.3'],
    ['C','≥60%','2.0'],['C-','≥55%','1.7'],['D+','≥50%','1.3'],
    ['D','≥45%','1.0'],['F','<45%','0.0']
  ];
  gpaScale.forEach(g => g.forEach(ss));
  ['Grade','Range','Points','Subject','Marks %','Att %','GPA Points'].forEach(ss);

  let s2rows = '';
  s2rows += `<row r="1" ht="30"><c r="A1" t="s" s="9"><v>${ss('GradeFlow Export')}</v></c></row>`;
  s2rows += `<row r="2" ht="16"><c r="A2" t="s" s="10"><v>${ss(uni + ' · ' + sem)}</v></c></row>`;
  s2rows += `<row r="3"/>`;
  s2rows += `<row r="4" ht="20">${sCell(4,1,ss('GPA'),1)}${nCell(4,2,gpa!==null?parseFloat(gpa.toFixed(2)):null,1)}</row>`;
  s2rows += `<row r="5" ht="18">${sCell(5,1,ss('Subjects'),2)}${nCell(5,2,subjects.length,2)}</row>`;
  s2rows += `<row r="6" ht="18">${sCell(6,1,ss('Credits'),2)}${nCell(6,2,subjects.reduce((a,s)=>a+s.credits,0),2)}</row>`;
  const overallAtt = calcOverallAtt();
  s2rows += `<row r="7" ht="18">${sCell(7,1,ss('Attendance'),2)}${nCell(7,2,overallAtt!==null?parseFloat(overallAtt.toFixed(2)):null,2)}</row>`;
  s2rows += `<row r="8"/>`;
  // Per-subject summary
  s2rows += `<row r="9" ht="20">${['Subject','Marks %','Att %','GPA Points'].map((h,i)=>sCell(9,i+1,ss(h),1)).join('')}</row>`;
  rows.forEach((r,ri) => {
    const rn = 10+ri;
    const g  = pctToGrade(r.marksPct);
    const gs = r.marksPct!==null?(r.marksPct>=75?6:r.marksPct>=60?7:8):0;
    s2rows += `<row r="${rn}" ht="17">`;
    s2rows += sCell(rn,1,ss(r.code+' — '+r.name), ri%2===0?0:5);
    s2rows += nCell(rn,2,r.marksPct, gs);
    s2rows += nCell(rn,3,r.attPct, r.attPct!==null?(r.attPct>=75?6:r.attPct>=60?7:8):0);
    s2rows += nCell(rn,4,r.marksPct!==null?parseFloat(g.points.toFixed(1)):null, 8);
    s2rows += `</row>`;
  });
  // GPA scale
  const scaleStart = 12 + rows.length;
  s2rows += `<row r="${scaleStart}"/>`;
  s2rows += `<row r="${scaleStart+1}" ht="20">${['Grade','Range','Points'].map((h,i)=>sCell(scaleStart+1,i+1,ss(h),1)).join('')}</row>`;
  gpaScale.forEach((g,gi) => {
    const rn = scaleStart+2+gi;
    s2rows += `<row r="${rn}" ht="16">${g.map((v,i)=>sCell(rn,i+1,ss(v),gi%2===0?0:5)).join('')}</row>`;
  });

  const sheet2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="4" width="12" customWidth="1"/>
  </cols>
  <sheetData>${s2rows}</sheetData>
</worksheet>`;

  // ── Shared strings XML ──
  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s=>`<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join('\n')}
</sst>`;

  // ── Workbook XML ──
  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Marks &amp; Data" sheetId="1" r:id="rId1"/>
    <sheet name="Summary" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"              ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"     ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml"     ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml"         ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml"                ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // ── ZIP assembly (using fflate or fallback to JSZip via CDN) ──
  // We'll use a minimal in-browser ZIP builder
  async function buildZip(files) {
    // files: { path: string, data: string }[]
    // Uses CompressionStream if available, else store
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    function crc32(buf) {
      let c = 0xFFFFFFFF;
      const table = crc32.t || (crc32.t = (() => {
        const t = new Uint32Array(256);
        for (let i=0;i<256;i++){let v=i;for(let j=0;j<8;j++)v=v&1?(0xEDB88320^(v>>>1)):(v>>>1);t[i]=v;}
        return t;
      })());
      for (const b of buf) c = table[(c^b)&0xFF]^(c>>>8);
      return (c^0xFFFFFFFF)>>>0;
    }

    function u32(n) { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; }
    function u16(n) { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; }

    for (const f of files) {
      const data    = enc.encode(f.data);
      const name    = enc.encode(f.path);
      const crc     = crc32(data);
      const size    = data.length;
      // local file header
      const lfh = new Uint8Array([
        0x50,0x4B,0x03,0x04, // sig
        20,0,                 // version
        0,0,                  // flags
        0,0,                  // compression: store
        0,0,0,0,              // mod time/date
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(name.length),
        0,0,                  // extra length
      ]);
      const localEntry = new Uint8Array(lfh.length + name.length + data.length);
      localEntry.set(lfh); localEntry.set(name, lfh.length); localEntry.set(data, lfh.length + name.length);
      parts.push(localEntry);

      // central dir entry
      const cde = new Uint8Array([
        0x50,0x4B,0x01,0x02,
        20,0, 20,0, 0,0, 0,0, 0,0,0,0,
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(name.length), 0,0, 0,0, 0,0, 0,0,0,0, 0,0,0,0,
        ...u32(offset),
      ]);
      const fullCde = new Uint8Array(cde.length + name.length);
      fullCde.set(cde); fullCde.set(name, cde.length);
      central.push(fullCde);
      offset += localEntry.length;
    }

    const centralBuf = central.reduce((a,b) => { const c=new Uint8Array(a.length+b.length); c.set(a); c.set(b,a.length); return c; }, new Uint8Array(0));
    const eocd = new Uint8Array([
      0x50,0x4B,0x05,0x06, 0,0, 0,0,
      ...u16(central.length), ...u16(central.length),
      ...u32(centralBuf.length), ...u32(offset),
      0,0,
    ]);
    const all = new Uint8Array(offset + centralBuf.length + eocd.length);
    let pos = 0;
    for (const p of parts) { all.set(p, pos); pos += p.length; }
    all.set(centralBuf, pos); pos += centralBuf.length;
    all.set(eocd, pos);
    return all;
  }

  const files = [
    { path: '[Content_Types].xml',            data: contentTypes },
    { path: '_rels/.rels',                    data: pkgRels },
    { path: 'xl/workbook.xml',               data: wbXml },
    { path: 'xl/_rels/workbook.xml.rels',    data: wbRels },
    { path: 'xl/worksheets/sheet1.xml',      data: sheet1Xml },
    { path: 'xl/worksheets/sheet2.xml',      data: sheet2Xml },
    { path: 'xl/sharedStrings.xml',          data: ssXml },
    { path: 'xl/styles.xml',                 data: stylesXml },
  ];

  buildZip(files).then(zipBytes => {
    const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `GradeFlow_${sem.replace(/\s+/g,'_')}_${now.toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 Excel file exported!');
  });
}


function setupDataControls() {

  // ── EXPORT AS XLSX ──
  document.getElementById('btn-export').addEventListener('click', () => {
    exportAsXLSX();
  });

  // ── IMPORT JSON BACKUP ──
  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed._meta || !parsed._subjects) throw new Error('Invalid GradeFlow backup file.');
        DATA = parsed;
        SUBJECTS = DATA._subjects;
        // Ensure all subject data exists
        SUBJECTS.forEach(sub => {
          if (!DATA[sub.id]) DATA[sub.id] = defaultSubjectData();
        });
        saveData();
        applyTheme(DATA._meta.theme || 'light');
        updateNavLabel();
        renderAll();
        showToast('✅ Backup imported!');
      } catch (err) {
        showToast('❌ Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ── RESET ALL ──
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    openResetModal();
  });
}

/* ══════════════════════════════════════════════
   RESET MODAL LOGIC
══════════════════════════════════════════════ */
function openResetModal() {
  const modal = document.getElementById('reset-modal');
  modal.classList.remove('hidden');
  showResetStep(1);

  // Determine confirmation word: user's name if set, else "RESET"
  const confirmWord = (DATA._meta.name || '').trim().toUpperCase() || 'RESET';
  const wordEl = document.getElementById('reset-confirm-word');
  if (wordEl) wordEl.textContent = '"' + confirmWord + '"';

  const typeInput = document.getElementById('reset-type-input');
  const typeHint  = document.getElementById('reset-type-hint');
  const finalBtn  = document.getElementById('reset-final-go');
  if (typeInput) { typeInput.value = ''; }
  if (typeHint)  { typeHint.textContent = ''; typeHint.className = 'reset-type-hint'; }
  if (finalBtn)  { finalBtn.disabled = true; }

  // Step 1 → Step 2
  document.getElementById('reset-confirm-1').onclick = () => showResetStep(2);
  document.getElementById('reset-cancel-1').onclick  = closeResetModal;

  // Step 2 → Step 3
  document.getElementById('reset-confirm-2').onclick = () => showResetStep(3);
  document.getElementById('reset-cancel-2').onclick  = closeResetModal;

  // Step 3: typing validation
  if (typeInput) {
    typeInput.oninput = () => {
      const val = typeInput.value.trim().toUpperCase();
      if (val === confirmWord) {
        typeHint.textContent = '✓ Confirmed';
        typeHint.className   = 'reset-type-hint match';
        finalBtn.disabled    = false;
      } else if (val.length > 0) {
        typeHint.textContent = 'Not matching — keep typing';
        typeHint.className   = 'reset-type-hint no-match';
        finalBtn.disabled    = true;
      } else {
        typeHint.textContent = '';
        typeHint.className   = 'reset-type-hint';
        finalBtn.disabled    = true;
      }
    };
  }

  document.getElementById('reset-cancel-3').onclick = closeResetModal;

  if (finalBtn) {
    finalBtn.onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      DATA = null;
      SUBJECTS = [];
      closeResetModal();
      showSetup();
      showToast('🗑️ All data erased');
    };
  }
}

function showResetStep(n) {
  document.querySelectorAll('.reset-step').forEach(el => el.classList.remove('active'));
  const step = document.getElementById('reset-step-' + n);
  if (step) step.classList.add('active');
  // Re-focus input on step 3
  if (n === 3) {
    setTimeout(() => {
      const inp = document.getElementById('reset-type-input');
      if (inp) inp.focus();
    }, 100);
  }
}

function closeResetModal() {
  document.getElementById('reset-modal').classList.add('hidden');
}

/* ══════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════ */
let _dirty = true; // flag: data changed since last full render

function markDirty() { _dirty = true; }

function renderAll() {
  _dirty = false;
  updateDashboardStats();
  renderDashboard();
  renderMarks();
  renderAttendance();
  updateLastUpdatedLabel();
}

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
function updateDashboardStats() {
  const gpa = calcGPA();
  const att = calcOverallAtt();
  const cr  = totalCredits();

  const gpaEl = document.getElementById('stat-gpa');
  gpaEl.textContent = gpa !== null ? gpa.toFixed(2) : '—';
  gpaEl.style.color = gpa !== null
    ? (gpa >= 3.5 ? 'var(--green)' : gpa >= 2.5 ? 'var(--amber)' : 'var(--red)') : '';

  const attEl = document.getElementById('stat-attendance');
  attEl.textContent = att !== null ? att.toFixed(1) + '%' : '—';
  attEl.style.color = att !== null
    ? (att >= 75 ? 'var(--green)' : att >= 65 ? 'var(--amber)' : 'var(--red)') : '';

  document.getElementById('stat-subjects').textContent = SUBJECTS.length;
  document.getElementById('stat-credits').textContent  = cr;
}

function renderDashboard() {
  updateDashboardStats();
  const grid = document.getElementById('dashboard-cards');
  grid.innerHTML = '';

  SUBJECTS.forEach(sub => {
    const d      = DATA[sub.id];
    const pct    = calcSubjectPct(d.marks);
    const attPct = calcAttPctStrict(d.attendance);
    const g      = pctToGrade(pct);
    const attTot = d.attendance.present + d.attendance.absent + d.attendance.late;
    const attColor = attPct !== null ? (attPct >= 75 ? 'green' : attPct >= 65 ? 'amber' : 'red') : 'grade';

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    card.innerHTML = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${sub.code}</span>
        <span class="card-name">${sub.name}<small>${sub.credits} credit${sub.credits !== 1 ? 's' : ''}</small></span>
        <span class="card-badges">
          <span class="badge ${pct !== null ? badgeClass(pct) : 'badge-grade'}">${g.grade}</span>
          <span class="badge ${attPct !== null ? 'badge-' + attColor : 'badge-grade'}">
            ${attPct !== null ? attPct.toFixed(0) + '%' : 'Att'}
          </span>
        </span>
        <span class="card-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="card-body">
        <div class="dash-breakdown">
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Overall Marks</span>
            <span class="dash-breakdown-val ${pct !== null ? gradeColor(pct) : ''}">${pct !== null ? pct.toFixed(1) + '%' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Quizzes</span>
            <span class="dash-breakdown-val">${summarizeMarks(d.marks.quizzes, 10)}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Assignments</span>
            <span class="dash-breakdown-val">${summarizeMarks(d.marks.assignments, 10)}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">PBL</span>
            <span class="dash-breakdown-val">${d.marks.pbl !== null && d.marks.pbl !== '' ? Number(d.marks.pbl).toFixed(1) + '/10' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Mid Exam</span>
            <span class="dash-breakdown-val">${d.marks.mid !== null && d.marks.mid !== '' ? Number(d.marks.mid).toFixed(1) + '/25' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Final Exam</span>
            <span class="dash-breakdown-val">${d.marks.finalObt !== null && d.marks.finalTotal !== null && d.marks.finalObt !== '' && d.marks.finalTotal !== '' ? Number(d.marks.finalObt).toFixed(0) + '/' + Number(d.marks.finalTotal).toFixed(0) : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Attendance</span>
            <span class="dash-breakdown-val ${attPct !== null ? attColor : ''}">${attTot > 0 ? d.attendance.present + 'P / ' + d.attendance.absent + 'A / ' + d.attendance.late + 'L' : '—'}</span>
          </div>
        </div>
      </div>
    `;

    attachCardToggle(card);
    grid.appendChild(card);
  });
}

function summarizeMarks(arr, max) {
  const vals = arr.filter(v => v !== null && v !== '' && !isNaN(v));
  if (!vals.length) return '—';
  const sum = vals.reduce((a, b) => a + Number(b), 0);
  return `${sum.toFixed(0)}/${vals.length * max} (${vals.length}/${arr.length})`;
}

/* ══════════════════════════════════════════════
   MARKS
══════════════════════════════════════════════ */
function renderMarks() {
  const container = document.getElementById('marks-cards');
  container.innerHTML = '';

  SUBJECTS.forEach(sub => {
    const d   = DATA[sub.id];
    const pct = calcSubjectPct(d.marks);
    const g   = pctToGrade(pct);

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    card.innerHTML = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${sub.code}</span>
        <span class="card-name">${sub.name}<small>${sub.credits} credit${sub.credits !== 1 ? 's' : ''}</small></span>
        <span class="card-badges">
          <span class="badge ${pct !== null ? badgeClass(pct) : 'badge-grade'}" id="marks-badge-${sub.id}">
            ${g.grade}${pct !== null ? ' · ' + pct.toFixed(1) + '%' : ''}
          </span>
        </span>
        <span class="card-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="card-body">
        <div class="card-total-bar" id="marks-total-bar-${sub.id}">
          <span class="card-total-label">Subject Total</span>
          <span class="card-total-value" id="marks-total-val-${sub.id}">${pct !== null ? pct.toFixed(1) + '%' : '—'}</span>
          <span class="card-total-grade ${pct !== null ? gradeColor(pct) : ''}" id="marks-total-grade-${sub.id}">${g.grade}</span>
        </div>

        <div class="marks-section-title">Quizzes (each /10)</div>
        <div class="marks-grid">
          ${[0,1,2,3,4,5].map(i => buildMarkInput(sub.id, 'quiz', i, d.marks.quizzes[i], 10, `Q${i+1}`)).join('')}
        </div>

        <div class="marks-section-title">Assignments (each /10)</div>
        <div class="marks-grid">
          ${[0,1,2,3,4,5].map(i => buildMarkInput(sub.id, 'assign', i, d.marks.assignments[i], 10, `A${i+1}`)).join('')}
        </div>

        <div class="marks-section-title">PBL (/10)</div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'pbl', 0, d.marks.pbl, 10, 'PBL')}</div>

        <div class="marks-section-title">Mid Exam (/25)</div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'mid', 0, d.marks.mid, 25, 'Mid')}</div>

        <div class="marks-section-title">Final Exam (obtained / total)</div>
        <div class="final-row">
          <div class="marks-input-group">
            <label class="marks-label">Obtained</label>
            <input type="number" class="marks-input"
              id="marks-${sub.id}-finalObt"
              value="${d.marks.finalObt !== null ? d.marks.finalObt : ''}"
              placeholder="e.g. 38" min="0"
              data-subid="${sub.id}" data-field="finalObt" />
            <div class="marks-live-pct" id="marks-pct-${sub.id}-finalObt"></div>
          </div>
          <div class="marks-input-group">
            <label class="marks-label">Total</label>
            <input type="number" class="marks-input"
              id="marks-${sub.id}-finalTotal"
              value="${d.marks.finalTotal !== null ? d.marks.finalTotal : ''}"
              placeholder="e.g. 50" min="1"
              data-subid="${sub.id}" data-field="finalTotal" />
            <div class="marks-live-pct" id="marks-pct-${sub.id}-finalTotal"></div>
          </div>
        </div>

        <button class="btn-card-reset" data-subid="${sub.id}" data-page="marks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          Reset Marks
        </button>
      </div>
    `;

    attachCardToggle(card);
    container.appendChild(card);
  });

  attachMarksListeners();
  updateAllMarksBadges();
}

function buildMarkInput(subId, type, idx, val, max, label) {
  const fieldKey = type === 'quiz' ? `quiz-${idx}` : type === 'assign' ? `assign-${idx}` : type === 'pbl' ? 'pbl' : 'mid';
  const inputId  = `marks-${subId}-${fieldKey}`;
  const pctId    = `marks-pct-${subId}-${fieldKey}`;
  const pctText  = (val !== null && val !== '' && !isNaN(val)) ? ((Number(val) / max) * 100).toFixed(0) + '%' : '';
  const hasVal   = (val !== null && val !== '');

  return `
    <div class="marks-input-group">
      <label class="marks-label" for="${inputId}">${label}</label>
      <input type="number" class="marks-input${hasVal ? ' has-val' : ''}"
        id="${inputId}" value="${val !== null ? val : ''}"
        placeholder="0–${max}" min="0" max="${max}"
        data-subid="${subId}" data-type="${type}" data-idx="${idx}" data-max="${max}" />
      <div class="marks-live-pct${pctText ? (' ' + pctColor(val, max)) : ''}" id="${pctId}">${pctText}</div>
    </div>`;
}

function pctColor(val, max) {
  if (!val && val !== 0) return '';
  const p = (Number(val) / max) * 100;
  return p >= 75 ? 'good' : p >= 60 ? 'warn' : 'danger';
}

function attachMarksListeners() {
  document.querySelectorAll('#marks-cards .marks-input[data-type]').forEach(inp => {
    inp.addEventListener('input', () => {
      const subId = inp.dataset.subid;
      const type  = inp.dataset.type;
      const idx   = parseInt(inp.dataset.idx);
      const max   = parseInt(inp.dataset.max);
      const val   = inp.value.trim() === '' ? null : Math.min(Number(inp.value), max);
      if (val !== null && inp.value.trim() !== '') inp.value = val;

      const d = DATA[subId].marks;
      if (type === 'quiz')        d.quizzes[idx] = val;
      else if (type === 'assign') d.assignments[idx] = val;
      else if (type === 'pbl')    d.pbl = val;
      else if (type === 'mid')    d.mid = val;

      inp.classList.toggle('has-val', val !== null);

      const fieldKey = type === 'quiz' ? `quiz-${idx}` : type === 'assign' ? `assign-${idx}` : type === 'pbl' ? 'pbl' : 'mid';
      const pctEl = document.getElementById(`marks-pct-${subId}-${fieldKey}`);
      if (pctEl) {
        if (val !== null) {
          pctEl.textContent = ((val / max) * 100).toFixed(0) + '%';
          pctEl.className   = 'marks-live-pct ' + pctColor(val, max);
        } else {
          pctEl.textContent = '';
          pctEl.className   = 'marks-live-pct';
        }
      }

      saveData();
      updateSubjectMarksBadge(subId);
    });
  });

  document.querySelectorAll('#marks-cards .marks-input[data-field]').forEach(inp => {
    inp.addEventListener('input', () => {
      const subId = inp.dataset.subid;
      const field = inp.dataset.field;
      const val   = inp.value.trim() === '' ? null : Number(inp.value);
      DATA[subId].marks[field] = val;
      saveData();
      updateSubjectMarksBadge(subId);
      const pctEl = document.getElementById(`marks-pct-${subId}-${field}`);
      if (pctEl) {
        const d = DATA[subId].marks;
        if (d.finalObt !== null && d.finalTotal !== null && d.finalTotal > 0 && field === 'finalObt') {
          pctEl.textContent = ((d.finalObt / d.finalTotal) * 100).toFixed(0) + '%';
          pctEl.className   = 'marks-live-pct ' + pctColor(d.finalObt, d.finalTotal);
        } else {
          pctEl.textContent = '';
          pctEl.className   = 'marks-live-pct';
        }
      }
    });
  });

  document.querySelectorAll('.btn-card-reset[data-page="marks"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId   = btn.dataset.subid;
      const sub     = SUBJECTS.find(s => s.id === subId);
      const backup  = JSON.parse(JSON.stringify(DATA[subId].marks));
      DATA[subId].marks = defaultSubjectData().marks;
      saveData();
      renderMarks();
      showToast(`🗑️ Marks cleared for ${sub.code}. Tap to undo.`, 4000);
      // Undo on toast tap
      const toast = document.getElementById('toast');
      const undoFn = () => {
        DATA[subId].marks = backup;
        saveData();
        renderMarks();
        showToast(`↩️ Undo successful for ${sub.code}`);
        toast.removeEventListener('click', undoFn);
      };
      toast.addEventListener('click', undoFn);
    });
  });
}

function updateSubjectMarksBadge(subId) {
  const pct = calcSubjectPct(DATA[subId].marks);
  const g   = pctToGrade(pct);
  const badge = document.getElementById(`marks-badge-${subId}`);
  if (badge) {
    badge.textContent = `${g.grade}${pct !== null ? ' · ' + pct.toFixed(1) + '%' : ''}`;
    badge.className   = `badge ${pct !== null ? badgeClass(pct) : 'badge-grade'}`;
  }
  const valEl   = document.getElementById(`marks-total-val-${subId}`);
  if (valEl) valEl.textContent = pct !== null ? pct.toFixed(1) + '%' : '—';
  const gradeEl = document.getElementById(`marks-total-grade-${subId}`);
  if (gradeEl) {
    gradeEl.textContent = g.grade;
    gradeEl.className   = `card-total-grade ${pct !== null ? gradeColor(pct) : ''}`;
  }
}

function updateAllMarksBadges() {
  SUBJECTS.forEach(sub => updateSubjectMarksBadge(sub.id));
}

/* ══════════════════════════════════════════════
   ATTENDANCE
══════════════════════════════════════════════ */
function renderAttendance() {
  const container = document.getElementById('attendance-cards');
  container.innerHTML = '';

  SUBJECTS.forEach(sub => {
    const d        = DATA[sub.id];
    const att      = d.attendance;
    const total    = att.present + att.absent + att.late;
    const pct      = calcAttPctStrict(att);
    const attColor = pct !== null ? (pct >= 75 ? 'green' : pct >= 65 ? 'amber' : 'red') : '';
    const barClass = attColor === 'green' ? '' : attColor === 'amber' ? 'warn' : 'danger';

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    card.innerHTML = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${sub.code}</span>
        <span class="card-name">${sub.name}<small>${sub.credits} credit${sub.credits !== 1 ? 's' : ''}</small></span>
        <span class="card-badges">
          <span class="badge ${attBadgeClass(pct)}" id="att-badge-${sub.id}">
            ${pct !== null ? pct.toFixed(0) + '%' : '—'}
          </span>
        </span>
        <span class="card-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="card-body">
        <div class="att-log-buttons">
          <button class="att-btn att-btn-present" data-subid="${sub.id}" data-action="present">✓ Present</button>
          <button class="att-btn att-btn-absent"  data-subid="${sub.id}" data-action="absent">✕ Absent</button>
          <button class="att-btn att-btn-late"    data-subid="${sub.id}" data-action="late">⏱ Late</button>
        </div>
        <div class="att-summary" id="att-summary-${sub.id}">
          <div class="att-stat">
            <span class="att-stat-val green" id="att-present-${sub.id}">${att.present}</span>
            <span class="att-stat-label">Present</span>
          </div>
          <div class="att-stat">
            <span class="att-stat-val red" id="att-absent-${sub.id}">${att.absent}</span>
            <span class="att-stat-label">Absent</span>
          </div>
          <div class="att-stat">
            <span class="att-stat-val amber" id="att-late-${sub.id}">${att.late}</span>
            <span class="att-stat-label">Late</span>
          </div>
          <div class="att-stat">
            <span class="att-stat-val" id="att-total-${sub.id}">${total}</span>
            <span class="att-stat-label">Total</span>
          </div>
        </div>
        <div class="att-pct-bar-wrap">
          <div class="att-pct-bar ${barClass}" id="att-bar-${sub.id}" style="width:${pct !== null ? Math.min(pct,100).toFixed(1) : 0}%"></div>
        </div>
        <div class="att-pct-text" id="att-pct-text-${sub.id}">
          ${pct !== null ? pct.toFixed(1) + '% attendance' : 'No classes logged yet'}
        </div>
        <div class="marks-section-title">Manual Entry (override)</div>
        <div class="att-manual-row">
          <div>
            <div class="att-manual-label">Present</div>
            <input type="number" class="att-manual-input" id="att-manual-present-${sub.id}" value="${att.present}" min="0" data-subid="${sub.id}" data-field="present" />
          </div>
          <div>
            <div class="att-manual-label">Absent</div>
            <input type="number" class="att-manual-input" id="att-manual-absent-${sub.id}" value="${att.absent}" min="0" data-subid="${sub.id}" data-field="absent" />
          </div>
          <div>
            <div class="att-manual-label">Late</div>
            <input type="number" class="att-manual-input" id="att-manual-late-${sub.id}" value="${att.late}" min="0" data-subid="${sub.id}" data-field="late" />
          </div>
          <div>
            <div class="att-manual-label">Total</div>
            <input type="number" class="att-manual-input" id="att-manual-total-${sub.id}" value="${total}" min="0" data-subid="${sub.id}" data-field="total" title="Setting total adjusts absent count automatically" />
          </div>
        </div>
        <button class="btn-card-reset" data-subid="${sub.id}" data-page="attendance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          Reset Attendance
        </button>
      </div>
    `;

    attachCardToggle(card);
    container.appendChild(card);
  });

  attachAttendanceListeners();
}

function attachAttendanceListeners() {
  document.querySelectorAll('.att-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId  = btn.dataset.subid;
      const action = btn.dataset.action;
      DATA[subId].attendance[action]++;
      saveData();
      updateAttCard(subId);
      showToast(`✅ ${action.charAt(0).toUpperCase() + action.slice(1)} logged for ${subId}`);
    });
  });

  document.querySelectorAll('.att-manual-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const subId = inp.dataset.subid;
      const field = inp.dataset.field;
      const val   = Math.max(0, parseInt(inp.value) || 0);
      inp.value   = val;

      if (field === 'total') {
        const att   = DATA[subId].attendance;
        att.absent  = Math.max(0, val - att.present - att.late);
        const absentInp = document.getElementById(`att-manual-absent-${subId}`);
        if (absentInp) absentInp.value = att.absent;
      } else {
        DATA[subId].attendance[field] = val;
      }

      saveData();
      updateAttCard(subId);
    });
  });

  document.querySelectorAll('.btn-card-reset[data-page="attendance"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId  = btn.dataset.subid;
      const sub    = SUBJECTS.find(s => s.id === subId);
      const backup = JSON.parse(JSON.stringify(DATA[subId].attendance));
      DATA[subId].attendance = defaultSubjectData().attendance;
      saveData();
      renderAttendance();
      showToast(`🗑️ Attendance cleared for ${sub.code}. Tap to undo.`, 4000);
      const toast = document.getElementById('toast');
      const undoFn = () => {
        DATA[subId].attendance = backup;
        saveData();
        renderAttendance();
        showToast(`↩️ Undo successful for ${sub.code}`);
        toast.removeEventListener('click', undoFn);
      };
      toast.addEventListener('click', undoFn);
    });
  });
}

function updateAttCard(subId) {
  const att   = DATA[subId].attendance;
  const total = att.present + att.absent + att.late;
  const pct   = calcAttPctStrict(att);
  const attColor = pct !== null ? (pct >= 75 ? 'green' : pct >= 65 ? 'amber' : 'red') : '';
  const barClass = attColor === 'green' ? '' : attColor === 'amber' ? 'warn' : 'danger';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set(`att-present-${subId}`, att.present);
  set(`att-absent-${subId}`,  att.absent);
  set(`att-late-${subId}`,    att.late);
  set(`att-total-${subId}`,   total);

  ['present','absent','late'].forEach(f => {
    const inp = document.getElementById(`att-manual-${f}-${subId}`);
    if (inp) inp.value = att[f];
  });
  const tInp = document.getElementById(`att-manual-total-${subId}`);
  if (tInp) tInp.value = total;

  const barEl = document.getElementById(`att-bar-${subId}`);
  if (barEl) {
    barEl.style.width = pct !== null ? Math.min(pct, 100).toFixed(1) + '%' : '0%';
    barEl.className   = `att-pct-bar${barClass ? ' ' + barClass : ''}`;
  }

  const pctText = document.getElementById(`att-pct-text-${subId}`);
  if (pctText) pctText.textContent = pct !== null ? pct.toFixed(1) + '% attendance' : 'No classes logged yet';

  const badge = document.getElementById(`att-badge-${subId}`);
  if (badge) {
    badge.textContent = pct !== null ? pct.toFixed(0) + '%' : '—';
    badge.className   = `badge ${attBadgeClass(pct)}`;
  }
}

/* ══════════════════════════════════════════════
   ANALYZE
══════════════════════════════════════════════ */
function renderAnalyze() {
  const gpa   = calcGPA();
  const gpaEl = document.getElementById('analyze-gpa-value');

  if (gpa !== null) {
    gpaEl.textContent = gpa.toFixed(2);
    gpaEl.className   = 'big-gpa-value ' + (gpa >= 3.5 ? 'green' : gpa >= 2.5 ? 'amber' : 'red');
    document.getElementById('analyze-gpa-grade').textContent =
      gpa >= 3.5 ? '🎉 Excellent Standing' : gpa >= 2.5 ? '⚡ Satisfactory' : '⚠️ Needs Improvement';
  } else {
    gpaEl.textContent = '—';
    gpaEl.className   = 'big-gpa-value';
    document.getElementById('analyze-gpa-grade').textContent = 'No data entered yet';
  }

  const entered = SUBJECTS.filter(sub => {
    const m = DATA[sub.id].marks;
    return m.quizzes.some(v => v !== null && v !== '') ||
           m.assignments.some(v => v !== null && v !== '') ||
           m.pbl !== null || m.mid !== null || m.finalObt !== null;
  }).length;
  document.getElementById('semester-progress-text').textContent =
    `Data entered for ${entered} of ${SUBJECTS.length} subjects · ${totalCredits()} total credits`;

  renderBarChart('chart-marks', SUBJECTS.map(sub => ({
    label: sub.code, pct: calcSubjectPct(DATA[sub.id].marks)
  })));
  renderBarChart('chart-attendance', SUBJECTS.map(sub => ({
    label: sub.code, pct: calcAttPctStrict(DATA[sub.id].attendance)
  })));

  // Strengths ≥ 80%
  const strengthsEl = document.getElementById('strengths-list');
  strengthsEl.innerHTML = '';
  let hasStrength = false;
  SUBJECTS.forEach(sub => {
    const pct = calcSubjectPct(DATA[sub.id].marks);
    if (pct !== null && pct >= 80) {
      hasStrength = true;
      strengthsEl.innerHTML += `<div class="sw-item green"><span class="sw-item-name">${sub.code} — ${sub.name}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasStrength) strengthsEl.innerHTML = '<div class="empty-msg">No subject ≥ 80% yet. Keep going! 💪</div>';

  // Weaknesses < 60%
  const weaknessesEl = document.getElementById('weaknesses-list');
  weaknessesEl.innerHTML = '';
  let hasWeak = false;
  SUBJECTS.forEach(sub => {
    const pct = calcSubjectPct(DATA[sub.id].marks);
    if (pct !== null && pct < 60) {
      hasWeak = true;
      weaknessesEl.innerHTML += `<div class="sw-item red"><span class="sw-item-name">${sub.code} — ${sub.name}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasWeak) weaknessesEl.innerHTML = '<div class="empty-msg">Nothing below 60%. Nice work! 🌟</div>';

  // Attendance risk < 75%
  const attRiskEl = document.getElementById('att-risk-list');
  attRiskEl.innerHTML = '';
  let hasRisk = false;
  SUBJECTS.forEach(sub => {
    const pct = calcAttPctStrict(DATA[sub.id].attendance);
    if (pct !== null && pct < 75) {
      hasRisk = true;
      const cl = pct >= 65 ? 'amber' : 'red';
      attRiskEl.innerHTML += `<div class="sw-item ${cl}"><span class="sw-item-name">${sub.code} — ${sub.name}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasRisk) attRiskEl.innerHTML = '<div class="empty-msg">All subjects above 75% ✅ Great attendance!</div>';

  // Calc subject options
  const calcSubSel = document.getElementById('calc-subject');
  calcSubSel.innerHTML = SUBJECTS.map(s => `<option value="${s.id}">${s.code} — ${s.name}</option>`).join('');
}

function renderBarChart(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = items.length ? '' : '<div class="empty-msg">No data entered yet.</div>';

  items.forEach(item => {
    const pct   = item.pct;
    const color = pct !== null ? (pct >= 75 ? 'bar-green' : pct >= 60 ? 'bar-amber' : 'bar-red') : '';
    const width = pct !== null ? Math.min(pct, 100).toFixed(1) : 0;

    el.innerHTML += `
      <div class="bar-row">
        <span class="bar-label">${item.label}</span>
        <div class="bar-track">
          <div class="bar-fill ${pct !== null ? color : ''}" style="width:${width}%">
            ${pct !== null && pct >= 15 ? `<span class="bar-pct">${pct.toFixed(0)}%</span>` : ''}
          </div>
        </div>
        <span class="bar-val">${pct !== null ? pct.toFixed(0) + '%' : '—'}</span>
      </div>`;
  });
}

/* ─── CALCULATOR ─── */
function setupCalculator() {
  document.getElementById('btn-calculate').addEventListener('click', () => {
    const subId      = document.getElementById('calc-subject').value;
    const targetPct  = parseFloat(document.getElementById('calc-target').value);
    const finalTotal = parseFloat(document.getElementById('calc-final-total').value);
    const resultEl   = document.getElementById('calc-result');

    if (!subId || isNaN(targetPct)) { resultEl.textContent = 'Please select a subject and target grade.'; return; }
    if (isNaN(finalTotal) || finalTotal <= 0) { resultEl.textContent = 'Please enter the final exam total marks.'; return; }

    const sub = SUBJECTS.find(s => s.id === subId);
    const d   = DATA[subId].marks;
    let weightedSum = 0, weightCurr = 0;

    const quizVals = d.quizzes.filter(v => v !== null && v !== '' && !isNaN(v));
    if (quizVals.length > 0) { weightedSum += (quizVals.reduce((a,b)=>a+Number(b),0)/(quizVals.length*10))*15; weightCurr+=15; }

    const assVals = d.assignments.filter(v => v !== null && v !== '' && !isNaN(v));
    if (assVals.length > 0) { weightedSum += (assVals.reduce((a,b)=>a+Number(b),0)/(assVals.length*10))*10; weightCurr+=10; }

    if (d.pbl !== null && d.pbl !== '' && !isNaN(d.pbl)) { weightedSum += (Number(d.pbl)/10)*5; weightCurr+=5; }
    if (d.mid !== null && d.mid !== '' && !isNaN(d.mid)) { weightedSum += (Number(d.mid)/25)*25; weightCurr+=25; }

    const finalWeight  = 45;
    const totalWeight  = weightCurr + finalWeight;
    const requiredFinalPct = ((targetPct * totalWeight / 100) - weightedSum) * 100 / finalWeight;
    const requiredMarks    = (requiredFinalPct / 100) * finalTotal;
    const g = pctToGrade(targetPct);

    if (requiredFinalPct <= 0) {
      resultEl.textContent = `🎉 You've already secured ${g.grade} for ${sub.code} regardless of the final!`;
      resultEl.style.color = 'var(--green)';
    } else if (requiredFinalPct > 100) {
      resultEl.textContent = `❌ Even 100% on the final won't achieve ${g.grade} for ${sub.code} with your current marks.`;
      resultEl.style.color = 'var(--red)';
    } else {
      resultEl.innerHTML = `To get <strong> ${g.grade} </strong> in <strong>${sub.code}</strong>, score at least <strong>${requiredMarks.toFixed(1)} / ${finalTotal}</strong> on the final (${requiredFinalPct.toFixed(1)}%).`;
      resultEl.style.color = requiredFinalPct >= 80 ? 'var(--amber)' : 'var(--green)';
    }
  });
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
let DATA = null;

document.addEventListener('DOMContentLoaded', () => {
  const saved = loadData();

  if (!saved) {
    // Fresh start — show setup
    DATA = initData([], {});
    setupWizard();
    showSetup();
  } else {
    DATA     = saved;
    SUBJECTS = DATA._subjects || DEFAULT_SUBJECTS;
    // Migrate old format (no _subjects key)
    if (!DATA._subjects) {
      DATA._subjects = DEFAULT_SUBJECTS;
      SUBJECTS = DEFAULT_SUBJECTS;
    }
    setupWizard(); // setup wizard listeners (needed even if hidden, for reset-all)
    hideSetup();
    applyTheme(DATA._meta.theme || 'light');
    updateNavLabel();
    renderAll();
  }

  setupTheme();
  setupTabs();
  setupDataControls();
  setupCalculator();
});
