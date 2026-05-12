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

/* ─── LAB DETECTION ─── */
function isLabSubject(sub) {
  if (sub.isLab === true) return true;
  // Auto-detect by name for backward compatibility. Match only standalone tokens like
  // "Lab" or "Lab " and avoid false positives from words such as "Lab-on-a-Chip".
  return /(^|[\s:;,.!?"'()\[\]-])lab($|[\s:;,.!?"'()\[\]-])/i.test(sub.name);
}

/* ─── RUNTIME SUBJECTS (loaded from DATA) ─── */
let SUBJECTS = [];

/* ─── DEFAULT DATA PER SUBJECT ─── */
function defaultSubjectData() {
  return {
    marks: {
      quizzes:     [null, null, null, null, null, null],
      assignments: [null, null, null, null, null, null],
      tasks:       [],   // lab: dynamic array of task marks (/10 each)
      vivas:       [],   // lab: dynamic array of viva marks (/10 each)
      pbl:         null,
      oel:         null,
      mid:         null,
      finalObt:    null,
      finalTotal:  null,
      classAvg:    null, // Bug G fix: initialize so it survives resets and JSON round-trips
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

function sanitizeBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup format.');
  if (!parsed._meta || !Array.isArray(parsed._subjects)) throw new Error('Invalid GradeFlow backup file.');
  const subjects = parsed._subjects.map(sub => {
    if (!sub || typeof sub !== 'object' || !sub.id) throw new Error('Backup subjects list is corrupt.');
    return {
      id: String(sub.id),
      code: String(sub.code || sub.id),
      name: String(sub.name || sub.code || sub.id),
      credits: Number.isFinite(Number(sub.credits)) ? Number(sub.credits) : 3,
    };
  });

  const sanitized = {
    _meta: {
      // Whitelist only known _meta fields — never spread untrusted backup _meta blindly
      lastUpdated: parsed._meta.lastUpdated || null,
      theme:       parsed._meta.theme === 'dark' ? 'dark' : 'light',
      name:        typeof parsed._meta.name     === 'string' ? parsed._meta.name     : '',
      uni:         typeof parsed._meta.uni      === 'string' ? parsed._meta.uni      : '',
      semester:    typeof parsed._meta.semester === 'string' ? parsed._meta.semester : '',
    },
    _subjects: subjects,
  };

  const knownIds = new Set(subjects.map(sub => sub.id));
  Object.keys(parsed).forEach(key => {
    if (key === '_meta' || key === '_subjects') return;
    if (!knownIds.has(key)) return; // discard stale subject keys
    const item = parsed[key];
    sanitized[key] = {
      marks: (item && typeof item === 'object' && item.marks && typeof item.marks === 'object')
        ? { ...defaultSubjectData().marks, ...item.marks }
        : defaultSubjectData().marks,
      attendance: (item && typeof item === 'object' && item.attendance && typeof item.attendance === 'object')
        ? { ...defaultSubjectData().attendance, ...item.attendance }
        : defaultSubjectData().attendance,
    };
  });

  subjects.forEach(sub => {
    if (!sanitized[sub.id]) sanitized[sub.id] = defaultSubjectData();
    if (!Array.isArray(sanitized[sub.id].marks.quizzes)) sanitized[sub.id].marks.quizzes = defaultSubjectData().marks.quizzes.slice();
    if (!Array.isArray(sanitized[sub.id].marks.assignments)) sanitized[sub.id].marks.assignments = defaultSubjectData().marks.assignments.slice();
    if (!Array.isArray(sanitized[sub.id].marks.tasks)) sanitized[sub.id].marks.tasks = defaultSubjectData().marks.tasks.slice();
    if (!Array.isArray(sanitized[sub.id].marks.vivas)) sanitized[sub.id].marks.vivas = defaultSubjectData().marks.vivas.slice();
    if (sanitized[sub.id].marks.classAvg === undefined) sanitized[sub.id].marks.classAvg = null;
    if (!sanitized[sub.id].attendance || typeof sanitized[sub.id].attendance !== 'object') sanitized[sub.id].attendance = defaultSubjectData().attendance;
  });

  return sanitized;
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
  if (!DATA || !DATA._meta) return;
  DATA._meta.lastUpdated = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
  } catch {
    showToast('⚠️ Storage full — data may not save');
  }
  markDirty();
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

function normalizeMark(raw, max) {
  if (raw === null || raw === '' || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(n, max));
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

/* ─── HTML ESCAPE HELPER ─── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── MARKS CALCULATION ─── */
function calcSubjectPct(marks, sub) {
  // Lab subject calculation
  if (sub && isLabSubject(sub)) {
    let weightedSum = 0, weightTotal = 0;

    // Tasks: each /10, collectively weighted 50%
    const taskVals = (marks.tasks || []).filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
    if (taskVals.length > 0) {
      weightedSum += (taskVals.reduce((a, b) => a + b, 0) / (taskVals.length * 10)) * 50;
      weightTotal += 50;
    }

    // Vivas: each /10, collectively weighted 20%
    // Bug NULL-VIVA fix: removed fragile fallback to old marks.viva field since
    // migrateData() guarantees vivas[] exists. Checking only marks.vivas now.
    const vivaVals = (marks.vivas || []).filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
    if (vivaVals.length > 0) {
      weightedSum += (vivaVals.reduce((a, b) => a + b, 0) / (vivaVals.length * 10)) * 20;
      weightTotal += 20;
    }

    // OEL: /10, weighted 15%
    const oel = normalizeMark(marks.oel, 10);
    if (oel !== null) {
      weightedSum += (oel / 10) * 15;
      weightTotal += 15;
    }

    // PBL: /10, weighted 15%
    const pbl = normalizeMark(marks.pbl, 10);
    if (pbl !== null) {
      weightedSum += (pbl / 10) * 15;
      weightTotal += 15;
    }

    if (weightTotal === 0) return null;
    // Bug LAB-PCT fix: normalize by weightTotal so partial data doesn't score artificially low.
    // e.g. if only tasks entered (weightTotal=50), return 100-scale value not raw 0-50 value.
    return (weightedSum / weightTotal) * 100;
  }

  // Regular subject calculation
  let weightedSum = 0, weightTotal = 0;

  const quizVals = marks.quizzes.filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
  if (quizVals.length > 0) {
    weightedSum += (quizVals.reduce((a, b) => a + b, 0) / (quizVals.length * 10)) * 15;
    weightTotal += 15;
  }

  const assVals = marks.assignments.filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
  if (assVals.length > 0) {
    weightedSum += (assVals.reduce((a, b) => a + b, 0) / (assVals.length * 10)) * 10;
    weightTotal += 10;
  }

  const pbl = normalizeMark(marks.pbl, 10);
  if (pbl !== null) {
    weightedSum += (pbl / 10) * 5;
    weightTotal += 5;
  }

  const oel = normalizeMark(marks.oel, 10);
  if (oel !== null) {
    weightedSum += (oel / 10) * 5;
    weightTotal += 5;
  }

  const mid = normalizeMark(marks.mid, 25);
  if (mid !== null) {
    weightedSum += (mid / 25) * 25;
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
  // Late classes count as attended (present + late) for percentage calculation
  return ((att.present + att.late) / total) * 100;
}

/* ─── GPA ─── */
function calcGPA() {
  if (!DATA) return null;
  let totalPoints = 0, totalCredits = 0, enteredSubjects = 0;
  SUBJECTS.forEach(sub => {
    if (!DATA[sub.id]) return; // guard against missing data key
    const pct = calcSubjectPct(DATA[sub.id].marks, sub);
    if (pct !== null) {
      enteredSubjects += 1;
      totalCredits += sub.credits;
      const g = pctToGrade(pct);
      totalPoints += g.points * sub.credits;
    }
  });
  if (enteredSubjects === 0 || totalCredits === 0) return null;
  return totalPoints / totalCredits;
}

function calcOverallAtt() {
  if (!DATA) return null;
  let totalAttended = 0, totalClasses = 0;
  SUBJECTS.forEach(sub => {
    if (!DATA[sub.id]) return; // guard against missing data key
    const att = DATA[sub.id].attendance;
    // Consistent with calcAttPctStrict: late counts as attended
    totalAttended += att.present + att.late;
    totalClasses  += att.present + att.absent + att.late;
  });
  if (totalClasses === 0) return null;
  return (totalAttended / totalClasses) * 100;
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
  if (!DATA || !DATA._meta) { el.textContent = 'No data saved yet'; return; }
  const ts = DATA._meta.lastUpdated;
  if (!ts) { el.textContent = 'No data saved yet'; return; }
  const d = new Date(ts);
  el.textContent = `Last saved: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function updateNavLabel() {
  const el = document.getElementById('nav-semester-label');
  if (!el) return;
  if (!DATA || !DATA._meta) { el.textContent = 'Student Tracker'; return; }
  const sem = DATA._meta.semester || '';
  const uni = DATA._meta.uni || '';
  el.textContent = [uni, sem].filter(Boolean).join(' · ') || 'Student Tracker';
}

/* ─── THEME ─── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (DATA && DATA._meta) DATA._meta.theme = theme;
}

/* ══════════════════════════════════════════════
   SETUP WIZARD
══════════════════════════════════════════════ */
let _wizardSetupDone = false;

function showSetup() {
  document.getElementById('setup-overlay').classList.remove('hidden');
  showStep(1);
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
  rows.forEach((row, i) => {
    const code    = row.querySelector('.csr-code').value.trim().toUpperCase();
    const name    = row.querySelector('.csr-name').value.trim();
    const credits = Math.min(20, Math.max(1, parseInt(row.querySelector('.csr-credits').value) || 3));
    if (!code || !name) {
      // Skip blank rows
      return;
    }
    // Use stable deterministic ID — no Math.random() to ensure backup/restore consistency
    const id = `${code}_${i}`;
    subjects.push({ id, code, name, credits });
  });
  return subjects.length > 0 ? subjects : null;
}

function setupWizard() {
  if (_wizardSetupDone) return;
  _wizardSetupDone = true;

  // Step 1 → 2 (with validation)
  document.getElementById('step1-next').onclick = () => {
    const uni = document.getElementById('setup-uni').value.trim();
    const sem = document.getElementById('setup-sem').value.trim();
    if (!uni) { showToast('⚠️ Please enter your university name.'); return; }
    if (!sem) { showToast('⚠️ Please enter your semester.'); return; }
    showStep(2);
  };

  // Setup wizard handlers are assigned via onclick to ensure that
  // reset/reinitialization does not stack duplicate listeners.
  document.getElementById('choice-default').onclick = () => {
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
  };

  document.getElementById('choice-custom').onclick = () => showStep(3);

  // Step 3: add row
  document.getElementById('btn-add-subject-row').onclick = addCustomSubjectRow;

  // Step 3: back
  document.getElementById('step3-back').onclick = () => showStep(2);

  // Step 3: done
  document.getElementById('step3-done').onclick = () => {
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
  };
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
      // Don't switch tabs while setup wizard is open — DATA may not be ready yet
      if (!document.getElementById('setup-overlay').classList.contains('hidden')) return;

      const page = btn.dataset.page;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      // Always re-render analyze on tab switch so charts/lists are never stale
      if (page === 'analyze') renderAnalyze();
      // Bug DASH-STALE fix: also call updateDashboardStats() on tab-switch so the
      // top stat cards (GPA, attendance) stay current even when renderAll() isn't called.
      if (page === 'dashboard' && _dirty) {
        renderDashboard();
        updateDashboardStats();
        _dirty = false;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ══════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════ */
function setupTheme() {
  applyTheme((DATA && DATA._meta && DATA._meta.theme) ? DATA._meta.theme : 'light');
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
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i=0;i<256;i++){let v=i;for(let j=0;j<8;j++)v=v&1?(0xEDB88320^(v>>>1)):(v>>>1);t[i]=v;}
    return t;
  })();
  const subjects = SUBJECTS;
  const now      = new Date();
  const dateStr  = now.toLocaleDateString();
  const uni      = DATA._meta.uni      || 'My University';
  const sem      = DATA._meta.semester || 'Current Semester';
  const name     = DATA._meta.name     || '';

  const safe = v => (v === null || v === undefined || v === '') ? '' : String(v);
  const num  = v => (v === null || v === undefined || v === '') ? null : Number(v);

  const rows = subjects.map(sub => {
    const d      = DATA[sub.id];
    const m      = d.marks;
    const att    = d.attendance;
    const pct    = calcSubjectPct(m, sub);
    const attPct = calcAttPctStrict(att);
    const g      = pctToGrade(pct);
    return {
      code: sub.code, name: sub.name, credits: sub.credits,
      q: m.quizzes.map(v => num(v)),
      a: m.assignments.map(v => num(v)),
      pbl: num(m.pbl), oel: num(m.oel), mid: num(m.mid),
      finalObt: num(m.finalObt), finalTotal: num(m.finalTotal),
      marksPct: pct !== null ? parseFloat(pct.toFixed(2)) : null,
      grade: pct !== null ? g.grade : '-',
      present: att.present, absent: att.absent, late: att.late,
      attPct: attPct !== null ? parseFloat(attPct.toFixed(2)) : null,
    };
  });

  const gpa = calcGPA();

  function xmlEscape(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const strings = [];
  const strIdx  = {};
  function ss(v) {
    const k = String(v);
    if (strIdx[k] === undefined) { strIdx[k] = strings.length; strings.push(k); }
    return strIdx[k];
  }

  const headers1 = ['Code','Subject','Credits','Q1','Q2','Q3','Q4','Q5','Q6','A1','A2','A3','A4','A5','A6','PBL','OEL','Mid (/25)','Final Obtained','Final Total','Marks %','Grade','Present','Absent','Late','Attendance %'];
  headers1.forEach(ss);
  rows.forEach(r => { ss(r.code); ss(r.name); ss(r.grade); });
  [uni, sem, name || 'Student', 'GradeFlow Export', dateStr, 'GPA', 'Subjects', 'Credits', 'Attendance'].forEach(ss);
  ['A (≥90%)','A- (≥85%)','B+ (≥80%)','B (≥75%)','B- (≥70%)','C+ (≥65%)','C (≥60%)','C- (≥55%)','D+ (≥50%)','D (≥45%)','F (<45%)'].forEach(ss);

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

  function col(n) {
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

  let s1rows = '';
  s1rows += `<row r="1" ht="28" customHeight="1"><c r="A1" t="s" s="9"><v>${ss('GradeFlow Export')}</v></c></row>`;
  s1rows += `<row r="2" ht="16"><c r="A2" t="s" s="10"><v>${ss(uni + ' · ' + sem + (name ? ' · ' + name : '') + '   Exported: ' + dateStr)}</v></c></row>`;
  s1rows += `<row r="3"/>`;
  let hrow = `<row r="4" ht="20">`;
  headers1.forEach((h, i) => { hrow += sCell(4, i+1, ss(h), 1); });
  hrow += `</row>`;
  s1rows += hrow;

  rows.forEach((r, ri) => {
    const rowNum = ri + 5;
    const altFill = ri % 2 === 1 ? 5 : 0;
    const baseStyle = altFill === 5 ? 5 : 0;
    const numStyle  = 3;
    let drow = `<row r="${rowNum}" ht="18">`;
    drow += sCell(rowNum, 1, ss(r.code), altFill === 5 ? 5 : 0);
    drow += sCell(rowNum, 2, ss(r.name),    baseStyle);
    drow += nCell(rowNum, 3, r.credits,     8);
    r.q.forEach((v,i)  => { drow += nCell(rowNum, 4+i,  v, numStyle); });
    r.a.forEach((v,i)  => { drow += nCell(rowNum, 10+i, v, numStyle); });
    drow += nCell(rowNum, 16, r.pbl,         numStyle);
    drow += nCell(rowNum, 17, r.oel,         numStyle);
    drow += nCell(rowNum, 18, r.mid,         numStyle);
    drow += nCell(rowNum, 19, r.finalObt,    numStyle);
    drow += nCell(rowNum, 20, r.finalTotal,  numStyle);
    drow += nCell(rowNum, 21, r.marksPct,    3);
    const gradeStyle = r.marksPct !== null ? (r.marksPct >= 75 ? 6 : r.marksPct >= 60 ? 7 : 8) : 2;
    drow += sCell(rowNum, 22, ss(r.grade),  gradeStyle);
    drow += nCell(rowNum, 23, r.present,    numStyle);
    drow += nCell(rowNum, 24, r.absent,     numStyle);
    drow += nCell(rowNum, 25, r.late,       numStyle);
    drow += nCell(rowNum, 26, r.attPct,     3);
    drow += `</row>`;
    s1rows += drow;
  });

  const totalRow = rows.length + 5;
  s1rows += `<row r="${totalRow}" ht="18">`;
  s1rows += sCell(totalRow, 2, ss('TOTAL / AVERAGE'), 1);
  s1rows += nCell(totalRow, 3, subjects.reduce((a,s)=>a+s.credits,0), 1);
  if (rows.some(r => r.marksPct !== null)) {
    let totalPoints = 0, totalCredits = 0;
    rows.forEach(r => {
      if (r.marksPct !== null) {
        totalPoints += r.marksPct * r.credits;
        totalCredits += r.credits;
      }
    });
    const avg = totalCredits > 0 ? totalPoints / totalCredits : null;
    if (avg !== null) s1rows += nCell(totalRow, 21, parseFloat(avg.toFixed(2)), 1);
  }
  if (gpa !== null) s1rows += nCell(totalRow, 22, parseFloat(gpa.toFixed(2)), 1);
  const totalPres = rows.reduce((a,r)=>a+r.present,0);
  const totalAbs  = rows.reduce((a,r)=>a+r.absent,0);
  const totalLate = rows.reduce((a,r)=>a+r.late,0);
  s1rows += nCell(totalRow, 23, totalPres, 1);
  s1rows += nCell(totalRow, 24, totalAbs,  1);
  s1rows += nCell(totalRow, 25, totalLate, 1);
  const totClasses = totalPres+totalAbs+totalLate;
  if (totClasses>0) s1rows += nCell(totalRow, 26, parseFloat(((totalPres+totalLate)/totClasses*100).toFixed(2)), 1);
  s1rows += `</row>`;

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
  s2rows += `<row r="9" ht="20">${['Subject','Marks %','Att %','GPA Points'].map((h,i)=>sCell(9,i+1,ss(h),1)).join('')}</row>`;
  rows.forEach((r,ri) => {
    const rn = 10+ri;
    const g  = pctToGrade(r.marksPct);
    const gs = r.marksPct!==null?(r.marksPct>=75?6:r.marksPct>=60?7:8):0;
    s2rows += `<row r="${rn}" ht="17">`;
    s2rows += sCell(rn,1,ss(r.code+' — '+r.name), ri%2===0?0:5);
    s2rows += nCell(rn,2,r.marksPct, gs);
    s2rows += nCell(rn,3,r.attPct, r.attPct!==null?(r.attPct>=75?6:r.attPct>=60?7:8):0);
    s2rows += nCell(rn,4,r.marksPct!==null && g.points!==null?parseFloat(g.points.toFixed(1)):null, 8);
    s2rows += `</row>`;
  });
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

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s=>`<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join('\n')}
</sst>`;

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

  async function buildZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    function crc32(buf) {
      let c = 0xFFFFFFFF;
      for (const b of buf) c = crcTable[(c^b)&0xFF]^(c>>>8);
      return (c^0xFFFFFFFF)>>>0;
    }

    function u32(n) { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; }
    function u16(n) { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; }

    for (const f of files) {
      const data    = enc.encode(f.data);
      const name    = enc.encode(f.path);
      const crc     = crc32(data);
      const size    = data.length;
      const lfh = new Uint8Array([
        0x50,0x4B,0x03,0x04,
        20,0,
        0,0,
        0,0,
        0,0,0,0,
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(name.length),
        0,0,
      ]);
      const localEntry = new Uint8Array(lfh.length + name.length + data.length);
      localEntry.set(lfh); localEntry.set(name, lfh.length); localEntry.set(data, lfh.length + name.length);
      parts.push(localEntry);

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
  });
}


function exportAsJSON() {
  if (!DATA) return;
  const json = JSON.stringify(DATA, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const sem  = (DATA._meta && DATA._meta.semester) ? DATA._meta.semester.replace(/\s+/g, '_') : 'backup';
  a.href     = url;
  a.download = `GradeFlow_${sem}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function setupDataControls() {

  document.getElementById('btn-export').addEventListener('click', () => {
    exportAsXLSX();
    exportAsJSON();
    showToast('📦 Excel + JSON backup exported!');
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        DATA = sanitizeBackup(parsed);
        migrateData(DATA);
        SUBJECTS = DATA._subjects;
        SUBJECTS.forEach(sub => {
          if (!DATA[sub.id]) DATA[sub.id] = defaultSubjectData();
          if (!DATA[sub.id].marks) DATA[sub.id].marks = defaultSubjectData().marks;
          if (!DATA[sub.id].attendance) DATA[sub.id].attendance = defaultSubjectData().attendance;
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

  document.getElementById('btn-reset-all').addEventListener('click', () => {
    openResetModal();
  });
}

/* ══════════════════════════════════════════════
   RESET MODAL LOGIC
══════════════════════════════════════════════ */
function openResetModal() {
  if (!DATA || !DATA._meta) return;
  const modal = document.getElementById('reset-modal');
  modal.classList.remove('hidden');
  showResetStep(1);

  const confirmWord = (DATA && DATA._meta && DATA._meta.name ? DATA._meta.name.trim().toUpperCase() : '') || 'RESET';
  const wordEl = document.getElementById('reset-confirm-word');
  if (wordEl) wordEl.textContent = '"' + confirmWord + '"';

  const typeInput = document.getElementById('reset-type-input');
  const typeHint  = document.getElementById('reset-type-hint');
  const finalBtn  = document.getElementById('reset-final-go');
  if (typeInput) { typeInput.value = ''; }
  if (typeHint)  { typeHint.textContent = ''; typeHint.className = 'reset-type-hint'; }
  if (finalBtn)  { finalBtn.disabled = true; }

  document.getElementById('reset-confirm-1').onclick = () => showResetStep(2);
  document.getElementById('reset-cancel-1').onclick  = closeResetModal;

  document.getElementById('reset-confirm-2').onclick = () => showResetStep(3);
  document.getElementById('reset-cancel-2').onclick  = closeResetModal;

  if (typeInput) {
    // Clear any previously assigned handler to prevent stacking closures
    typeInput.oninput = null;
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
    // Clear previous handler to prevent stacking on repeated modal opens
    finalBtn.onclick = null;
    finalBtn.onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      DATA = null;
      SUBJECTS = [];
      closeResetModal();
      // Bug RESET-WIZARD fix: reset the guard flag so setupWizard() can reassign
      // handlers cleanly on a fresh wizard session after reset.
      _wizardSetupDone = false;
      setupWizard();
      showSetup();
      showToast('🗑️ All data erased');
    };
  }
}

function showResetStep(n) {
  document.querySelectorAll('.reset-step').forEach(el => el.classList.remove('active'));
  const step = document.getElementById('reset-step-' + n);
  if (step) step.classList.add('active');
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
let _dirty = true;

function markDirty() { _dirty = true; }

function renderAll() {
  updateDashboardStats();
  renderDashboard();
  renderMarks();
  renderAttendance();
  // Only fully render Analyze if it's the active tab; otherwise mark dirty so it
  // refreshes on next visit. Always repopulate the calc-subject select so the
  // calculator is never stale regardless of which tab is active.
  const analyzePage = document.getElementById('page-analyze');
  if (analyzePage && analyzePage.classList.contains('active')) {
    renderAnalyze();
  } else {
    // Repopulate subject selector so calculator works after subject changes
    const calcSubSel = document.getElementById('calc-subject');
    if (calcSubSel) {
      calcSubSel.innerHTML = SUBJECTS.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.code)} — ${escHtml(s.name)}</option>`).join('');
    }
  }
  updateLastUpdatedLabel();
  _dirty = false;
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
  const grid = document.getElementById('dashboard-cards');
  grid.innerHTML = '';
  if (!DATA) return;

  SUBJECTS.forEach(sub => {
    if (!DATA[sub.id]) return; // skip if data key missing
    const d      = DATA[sub.id];
    const pct    = calcSubjectPct(d.marks, sub);
    const attPct = calcAttPctStrict(d.attendance);
    const g      = pctToGrade(pct);
    const attTot = d.attendance.present + d.attendance.absent + d.attendance.late;
    const attColor = attPct !== null ? (attPct >= 75 ? 'green' : attPct >= 65 ? 'amber' : 'red') : 'grade';

    const isLab = isLabSubject(sub);

    let breakdownRows;
    if (isLab) {
      const taskVals = (d.marks.tasks || []).filter(v => v !== null && v !== '');
      const vivaVals = (d.marks.vivas || []).filter(v => v !== null && v !== '');
      const taskSummary = taskVals.length
        ? escHtml(taskVals.map(Number).reduce((a, b) => a + b, 0).toFixed(0) + '/' + (taskVals.length * 10) + ' (' + taskVals.length + ' task' + (taskVals.length !== 1 ? 's' : '') + ')')
        : '—';
      const vivaSummary = vivaVals.length
        ? escHtml(vivaVals.map(Number).reduce((a, b) => a + b, 0).toFixed(0) + '/' + (vivaVals.length * 10) + ' (' + vivaVals.length + ' viva' + (vivaVals.length !== 1 ? 's' : '') + ')')
        : '—';
      breakdownRows = `
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Tasks</span>
            <span class="dash-breakdown-val">${taskSummary}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Viva</span>
            <span class="dash-breakdown-val">${vivaSummary}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">OEL (15%)</span>
            <span class="dash-breakdown-val">${d.marks.oel !== null && d.marks.oel !== '' ? Number(d.marks.oel).toFixed(1) + '/10' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">PBL (15%)</span>
            <span class="dash-breakdown-val">${d.marks.pbl !== null && d.marks.pbl !== '' ? Number(d.marks.pbl).toFixed(1) + '/10' : '—'}</span>
          </div>`;
    } else {
      breakdownRows = `
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Quizzes</span>
            <span class="dash-breakdown-val">${summarizeMarks(d.marks.quizzes, 10)}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Assignments</span>
            <span class="dash-breakdown-val">${summarizeMarks(d.marks.assignments, 10)}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">PBL (5%)</span>
            <span class="dash-breakdown-val">${d.marks.pbl !== null && d.marks.pbl !== '' ? Number(d.marks.pbl).toFixed(1) + '/10' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">OEL (5%)</span>
            <span class="dash-breakdown-val">${d.marks.oel !== null && d.marks.oel !== '' ? Number(d.marks.oel).toFixed(1) + '/10' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Mid Exam</span>
            <span class="dash-breakdown-val">${d.marks.mid !== null && d.marks.mid !== '' ? Number(d.marks.mid).toFixed(1) + '/25' : '—'}</span>
          </div>
          <div class="dash-breakdown-row">
            <span class="dash-breakdown-label">Final Exam</span>
            <span class="dash-breakdown-val">${d.marks.finalObt !== null && d.marks.finalTotal !== null && d.marks.finalObt !== '' && d.marks.finalTotal !== '' ? Number(d.marks.finalObt).toFixed(0) + '/' + Number(d.marks.finalTotal).toFixed(0) : '—'}</span>
          </div>`;
    }

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    // Bug ESC-DASH fix: escape sub.code, sub.name, sub.credits before innerHTML interpolation
    // to prevent XSS from custom subject names entered in the setup wizard.
    card.innerHTML = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${escHtml(sub.code)}</span>
        <span class="card-name">${escHtml(sub.name)}<small>${escHtml(String(sub.credits))} credit${sub.credits !== 1 ? 's' : ''}</small></span>
        <span class="card-badges">
          <span class="badge ${pct !== null ? badgeClass(pct) : 'badge-grade'}">${escHtml(g.grade)}</span>
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
          ${breakdownRows}
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
  const vals = arr.filter(v => v !== null && v !== '' && Number.isFinite(Number(v)));
  if (!vals.length) return '—';
  const sum = vals.reduce((a, b) => a + Number(b), 0);
  return `${sum.toFixed(0)}/${vals.length * max} (${vals.length}/${arr.length})`;
}

/* ─── DATA MIGRATION ─── */
function migrateData(data) {
  const subjects = data._subjects || [];
  subjects.forEach(sub => {
    const d = data[sub.id];
    if (!d || !d.marks) return;
    if (!d.marks.tasks) d.marks.tasks = [];
    if (!Array.isArray(d.marks.vivas)) {
      // Migrate old scalar viva → vivas[] for lab subjects
      if (isLabSubject(sub) && d.marks.viva !== null && d.marks.viva !== undefined && d.marks.viva !== '') {
        d.marks.vivas = [d.marks.viva];
      } else {
        // Discard stale viva field for non-lab subjects — warn so data loss is visible
        if (d.marks.viva !== null && d.marks.viva !== undefined && d.marks.viva !== '') {
          console.warn(`GradeFlow: discarding legacy viva value (${d.marks.viva}) for non-lab subject "${sub.code}" during migration.`);
        }
        d.marks.vivas = [];
      }
      delete d.marks.viva;
    } else if ('viva' in d.marks) {
      // vivas[] already exists but stale viva key is still present — clean it up
      delete d.marks.viva;
    }
    if (d.marks.classAvg === undefined) d.marks.classAvg = null;
  });
}

/* ══════════════════════════════════════════════
   MARKS
══════════════════════════════════════════════ */
function renderMarks() {
  const container = document.getElementById('marks-cards');
  container.innerHTML = '';
  if (!DATA) return;

  SUBJECTS.forEach(sub => {
    if (!DATA[sub.id]) return; // skip if data key missing
    const d   = DATA[sub.id];
    const pct = calcSubjectPct(d.marks, sub);
    const g   = pctToGrade(pct);

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    const isLab = isLabSubject(sub);

    // Bug ESC-DASH fix: escape sub.code and sub.name in card headers here too.
    const cardHeaderHtml = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${escHtml(sub.code)}</span>
        <span class="card-name">${escHtml(sub.name)}<small>${escHtml(String(sub.credits))} credit${sub.credits !== 1 ? 's' : ''}</small></span>
        <span class="card-badges">
          <span class="badge ${pct !== null ? badgeClass(pct) : 'badge-grade'}" id="marks-badge-${sub.id}">
            ${escHtml(g.grade)}${pct !== null ? ' · ' + pct.toFixed(1) + '%' : ''}
          </span>
        </span>
        <span class="card-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>`;

    const savedClassAvg = d.marks.classAvg !== undefined && d.marks.classAvg !== null ? d.marks.classAvg : '';
    const classAvgGrade = (savedClassAvg !== '' && !isNaN(savedClassAvg)) ? pctToGrade(Number(savedClassAvg)) : null;
    const totalBarHtml = `
      <div class="card-total-bar" id="marks-total-bar-${sub.id}">
        <span class="card-total-label">Subject Total</span>
        <span class="card-total-value" id="marks-total-val-${sub.id}">${pct !== null ? pct.toFixed(1) + '%' : '—'}</span>
        <span class="card-total-grade ${pct !== null ? gradeColor(pct) : ''}" id="marks-total-grade-${sub.id}">${escHtml(g.grade)}</span>
      </div>
      <div class="class-avg-block">
        <label class="class-avg-label" for="class-avg-${sub.id}">Class Average (%)</label>
        <div class="class-avg-row">
          <input type="number" class="marks-input class-avg-input" id="class-avg-${sub.id}"
            value="${savedClassAvg}" placeholder="e.g. 68" min="0" max="100" step="0.1"
            data-subid="${sub.id}" data-field="classAvg" />
          <span class="class-avg-result" id="class-avg-result-${sub.id}">${classAvgGrade ? classAvgGrade.grade + ' · ' + Number(savedClassAvg).toFixed(1) + '%' : '—'}</span>
          <span class="class-avg-gpa" id="class-avg-gpa-${sub.id}">${classAvgGrade && classAvgGrade.points !== null ? 'GPA ' + classAvgGrade.points.toFixed(1) : ''}</span>
        </div>
      </div>`;

    const resetBtn = `
      <button class="btn-card-reset" data-subid="${sub.id}" data-page="marks">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
        Reset Marks
      </button>`;

    let bodyHtml;

    if (isLab) {
      const tasksHtml = d.marks.tasks.map((v, i) =>
        buildMarkInput(sub.id, 'task', i, v, 10, `T${i+1}`)
      ).join('');

      const vivasHtml = d.marks.vivas.map((v, i) =>
        buildMarkInput(sub.id, 'viva', i, v, 10, `V${i+1}`)
      ).join('');

      bodyHtml = `
        ${totalBarHtml}
        <div class="marks-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>Tasks (each /10)</span>
          <button class="btn-lab-add-task" data-subid="${sub.id}" style="font-size:0.75rem;padding:2px 10px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-weight:600;">+ Add Task</button>
        </div>
        <div class="marks-grid lab-tasks-grid" id="lab-tasks-grid-${sub.id}">
          ${tasksHtml || '<div class="empty-msg">No tasks yet — tap "+ Add Task" to add one.</div>'}
        </div>

        <div class="marks-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>Viva (each /10)</span>
          <button class="btn-lab-add-viva" data-subid="${sub.id}" style="font-size:0.75rem;padding:2px 10px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-weight:600;">+ Add Viva</button>
        </div>
        <div class="marks-grid lab-vivas-grid" id="lab-vivas-grid-${sub.id}">
          ${vivasHtml || '<div class="empty-msg">No viva yet — tap "+ Add Viva" to add one.</div>'}
        </div>

        <div class="marks-section-title">OEL (/10) <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted);">optional</span></div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'oel', 0, d.marks.oel, 10, 'OEL')}</div>

        <div class="marks-section-title">PBL (/10) <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted);">optional</span></div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'pbl', 0, d.marks.pbl, 10, 'PBL')}</div>

        ${resetBtn}`;
    } else {
      bodyHtml = `
        ${totalBarHtml}

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

        <div class="marks-section-title">OEL (/10)</div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'oel', 0, d.marks.oel, 10, 'OEL')}</div>

        <div class="marks-section-title">Mid Exam (/25)</div>
        <div class="marks-grid-2">${buildMarkInput(sub.id, 'mid', 0, d.marks.mid, 25, 'Mid')}</div>

        <div class="marks-section-title">Final Exam (obtained / total)</div>
        <div class="final-row">
          <div class="marks-input-group">
            <label class="marks-label">Obtained</label>
            <input type="number" class="marks-input"
              id="marks-${sub.id}-finalObt"
              value="${d.marks.finalObt !== null ? d.marks.finalObt : ''}"
              placeholder="e.g. 38" min="0" ${d.marks.finalTotal ? `max="${Number(d.marks.finalTotal)}"` : ''} step="0.01"
              data-subid="${sub.id}" data-field="finalObt" />
            <div class="marks-live-pct" id="marks-pct-${sub.id}-finalObt"></div>
          </div>
          <div class="marks-input-group">
            <label class="marks-label">Total</label>
            <input type="number" class="marks-input"
              id="marks-${sub.id}-finalTotal"
              value="${d.marks.finalTotal !== null ? d.marks.finalTotal : ''}"
              placeholder="e.g. 50" min="1" step="0.01"
              data-subid="${sub.id}" data-field="finalTotal" />
            <div class="marks-live-pct" id="marks-pct-${sub.id}-finalTotal"></div>
          </div>
        </div>

        ${resetBtn}`;
    }

    card.innerHTML = cardHeaderHtml + `<div class="card-body">${bodyHtml}</div>`;

    attachCardToggle(card);
    container.appendChild(card);
  });

  attachMarksListeners();
  updateAllMarksBadges();
}

function buildMarkInput(subId, type, idx, val, max, label) {
  const fieldKey = type === 'quiz'   ? `quiz-${idx}`
                 : type === 'assign' ? `assign-${idx}`
                 : type === 'task'   ? `task-${idx}`
                 : type === 'viva'   ? `viva-${idx}`
                 : type === 'pbl'    ? 'pbl'
                 : type === 'oel'    ? 'oel'
                 : 'mid';
  const inputId  = `marks-${subId}-${fieldKey}`;
  const pctId    = `marks-pct-${subId}-${fieldKey}`;
  const pctText  = (val !== null && val !== '' && !isNaN(val)) ? ((Number(val) / max) * 100).toFixed(1) + '%' : '';
  const hasVal   = (val !== null && val !== '');

  const removeBtn = (type === 'task')
    ? `<button class="btn-lab-remove-task" data-subid="${subId}" data-idx="${idx}" title="Remove task" style="margin-left:4px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.9rem;line-height:1;padding:0 2px;">×</button>`
    : (type === 'viva')
    ? `<button class="btn-lab-remove-viva" data-subid="${subId}" data-idx="${idx}" title="Remove viva" style="margin-left:4px;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.9rem;line-height:1;padding:0 2px;">×</button>`
    : '';

  return `
    <div class="marks-input-group" ${type === 'task' ? `id="lab-task-group-${subId}-${idx}"` : type === 'viva' ? `id="lab-viva-group-${subId}-${idx}"` : ''}>
      <label class="marks-label" for="${inputId}">${label}${removeBtn}</label>
      <input type="number" class="marks-input${hasVal ? ' has-val' : ''}"
        id="${inputId}" value="${val !== null ? val : ''}"
        placeholder="0–${max}" min="0" max="${max}" step="0.01"
        data-subid="${subId}" data-type="${type}" data-idx="${idx}" data-max="${max}" />
      <div class="marks-live-pct${pctText ? (' ' + pctColor(val, max)) : ''}" id="${pctId}">${pctText}</div>
    </div>`;
}

function pctColor(val, max) {
  if (val === null || val === undefined || val === '' || isNaN(val)) return '';
  const p = (Number(val) / max) * 100;
  return p >= 75 ? 'good' : p >= 60 ? 'warn' : 'danger';
}

function attachMarksListeners() {
  document.querySelectorAll('#marks-cards .marks-input[data-type]').forEach(inp => {
    const type = inp.dataset.type;
    if (type === 'task' || type === 'viva') return;

    inp.addEventListener('input', () => {
      const subId = inp.dataset.subid;
      const idx   = parseInt(inp.dataset.idx);
      const max   = parseInt(inp.dataset.max);
      let rawVal  = inp.value.trim() === '' ? null : parseFloat(inp.value);
      const val   = rawVal === null ? null : Math.max(0, Math.min(rawVal, max));
      if (val !== null && inp.value.trim() !== '') inp.value = val;

      const d = DATA[subId].marks;
      if (type === 'quiz')        d.quizzes[idx] = val;
      else if (type === 'assign') d.assignments[idx] = val;
      else if (type === 'pbl')    d.pbl = val;
      else if (type === 'oel')    d.oel = val;
      else if (type === 'mid')    d.mid = val;

      inp.classList.toggle('has-val', val !== null);

      const fieldKey = type === 'quiz'   ? `quiz-${idx}`
                     : type === 'assign' ? `assign-${idx}`
                     : type === 'pbl'    ? 'pbl'
                     : type === 'oel'    ? 'oel'
                     : 'mid';
      const pctEl = document.getElementById(`marks-pct-${subId}-${fieldKey}`);
      if (pctEl) {
        if (val !== null) {
          pctEl.textContent = ((val / max) * 100).toFixed(1) + '%';
          pctEl.className   = 'marks-live-pct ' + pctColor(val, max);
        } else {
          pctEl.textContent = '';
          pctEl.className   = 'marks-live-pct';
        }
      }

      saveData();
      updateSubjectMarksBadge(subId);

      // Bug DASH-STALE fix: update dashboard if it's the active tab
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        renderDashboard();
        updateDashboardStats();
      }
    });
  });

  // ── Add Task button (labs) ──
  document.querySelectorAll('.btn-lab-add-task').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId = btn.dataset.subid;
      const d = DATA[subId].marks;
      if (!d.tasks) d.tasks = [];
      d.tasks.push(null);
      saveData();
      const grid = document.getElementById(`lab-tasks-grid-${subId}`);
      if (grid) {
        grid.innerHTML = d.tasks.map((v, i) => buildMarkInput(subId, 'task', i, v, 10, `T${i+1}`)).join('');
        grid.querySelectorAll('.marks-input[data-type]').forEach(inp => attachSingleMarkInput(inp));
        grid.querySelectorAll('.btn-lab-remove-task').forEach(rb => attachRemoveTaskBtn(rb));
      }
    });
  });

  // ── Add Viva button (labs) ──
  document.querySelectorAll('.btn-lab-add-viva').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId = btn.dataset.subid;
      const d = DATA[subId].marks;
      if (!d.vivas) d.vivas = [];
      d.vivas.push(null);
      saveData();
      const grid = document.getElementById(`lab-vivas-grid-${subId}`);
      if (grid) {
        grid.innerHTML = d.vivas.map((v, i) => buildMarkInput(subId, 'viva', i, v, 10, `V${i+1}`)).join('');
        grid.querySelectorAll('.marks-input[data-type]').forEach(inp => attachSingleMarkInput(inp));
        grid.querySelectorAll('.btn-lab-remove-viva').forEach(rb => attachRemoveVivaBtn(rb));
      }
    });
  });

  // ── Remove Task button (labs) ──
  document.querySelectorAll('.btn-lab-remove-task').forEach(btn => {
    attachRemoveTaskBtn(btn);
  });

  // ── Remove Viva button (labs) ──
  document.querySelectorAll('.btn-lab-remove-viva').forEach(btn => {
    attachRemoveVivaBtn(btn);
  });

  document.querySelectorAll('#marks-cards .marks-input[data-type="task"], #marks-cards .marks-input[data-type="viva"]').forEach(inp => {
    attachSingleMarkInput(inp);
  });

  document.querySelectorAll('#marks-cards .marks-input[data-field]').forEach(inp => {
    inp.addEventListener('input', () => {
      const subId = inp.dataset.subid;
      const field = inp.dataset.field;
      const parsed = Number(inp.value);
      const val    = inp.value.trim() === '' ? null : (Number.isFinite(parsed) ? parsed : null);
      if (!Number.isFinite(parsed) && inp.value.trim() !== '') inp.value = '';
      DATA[subId].marks[field] = val;

      // Bug 19 fix: clamp finalObt to finalTotal if finalObt > finalTotal
      if (field === 'finalObt' || field === 'finalTotal') {
        const d = DATA[subId].marks;
        const obtInput = document.getElementById(`marks-${subId}-finalObt`);
        if (field === 'finalTotal') {
          if (d.finalTotal !== null && obtInput) {
            obtInput.max = d.finalTotal;
          } else if (obtInput) {
            obtInput.removeAttribute('max');
          }
          if (d.finalTotal !== null && d.finalObt !== null && d.finalObt > d.finalTotal) {
            d.finalObt = d.finalTotal;
            DATA[subId].marks.finalObt = d.finalTotal;
            if (obtInput) obtInput.value = d.finalTotal;
            showToast('⚠️ Obtained marks clamped to total marks');
          }
        }
        if (field === 'finalObt' && d.finalTotal !== null && d.finalObt !== null && d.finalObt > d.finalTotal) {
          d.finalObt = d.finalTotal;
          DATA[subId].marks.finalObt = d.finalTotal;
          if (obtInput) obtInput.value = d.finalTotal;
          showToast('⚠️ Obtained marks clamped to total marks');
        }
      }

      saveData();
      updateSubjectMarksBadge(subId);

      // Bug DASH-STALE fix: update dashboard if it's the active tab
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        renderDashboard();
        updateDashboardStats();
      }

      // Bug PP fix: update live percentage for BOTH finalObt and finalTotal fields.
      // Previously only updated when field === 'finalObt', leaving the % stale when
      // the user changed the Total field.
      const pctEl = document.getElementById(`marks-pct-${subId}-${field}`);
      if (pctEl) {
        const d = DATA[subId].marks;
        if (
          d.finalObt !== null && d.finalTotal !== null &&
          d.finalTotal > 0 &&
          (field === 'finalObt' || field === 'finalTotal')
        ) {
          pctEl.textContent = ((d.finalObt / d.finalTotal) * 100).toFixed(0) + '%';
          pctEl.className   = 'marks-live-pct ' + pctColor(d.finalObt, d.finalTotal);
        } else {
          pctEl.textContent = '';
          pctEl.className   = 'marks-live-pct';
        }
      }

      if (field === 'classAvg') {
        const resultEl = document.getElementById(`class-avg-result-${subId}`);
        const gpaEl    = document.getElementById(`class-avg-gpa-${subId}`);
        if (val !== null && !isNaN(val)) {
          const cg = pctToGrade(val);
          if (resultEl) resultEl.textContent = cg.grade + ' · ' + Number(val).toFixed(1) + '%';
          if (gpaEl)    gpaEl.textContent    = cg.points !== null ? 'GPA ' + cg.points.toFixed(1) : '';
        } else {
          if (resultEl) resultEl.textContent = '—';
          if (gpaEl)    gpaEl.textContent    = '';
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
      const toast = document.getElementById('toast');
      clearTimeout(toast._timeout);
      const freshToast = toast.cloneNode(true);
      freshToast.id = 'toast';
      toast.parentNode.replaceChild(freshToast, toast);
      showToast(`🗑️ Marks cleared for ${sub.code}. Tap to undo.`, 4000);
      const currentToast = document.getElementById('toast');
      const undoFn = () => {
        DATA[subId].marks = backup;
        saveData();
        renderMarks();
        showToast(`↩️ Undo successful for ${sub.code}`);
        currentToast.removeEventListener('click', undoFn);
      };
      currentToast.addEventListener('click', undoFn);
    });
  });
}

function attachSingleMarkInput(inp) {
  inp.addEventListener('input', () => {
    const subId = inp.dataset.subid;
    const type  = inp.dataset.type;
    const idx   = parseInt(inp.dataset.idx);
    const max   = parseInt(inp.dataset.max);
    let rawVal  = inp.value.trim() === '' ? null : parseFloat(inp.value);
    const val   = rawVal === null ? null : Math.max(0, Math.min(rawVal, max));
    if (val !== null && inp.value.trim() !== '') inp.value = val;

    const d = DATA[subId].marks;
    if (type === 'task')      { if (!d.tasks) d.tasks = []; d.tasks[idx] = val; }
    else if (type === 'viva') { if (!d.vivas) d.vivas = []; d.vivas[idx] = val; }

    inp.classList.toggle('has-val', val !== null);

    const fieldKey = type === 'task' ? `task-${idx}` : `viva-${idx}`;
    const pctEl = document.getElementById(`marks-pct-${subId}-${fieldKey}`);
    if (pctEl) {
      if (val !== null) {
        pctEl.textContent = ((val / max) * 100).toFixed(1) + '%';
        pctEl.className   = 'marks-live-pct ' + pctColor(val, max);
      } else {
        pctEl.textContent = '';
        pctEl.className   = 'marks-live-pct';
      }
    }
    saveData();
    updateSubjectMarksBadge(subId);

    // Bug DASH-STALE fix: update dashboard if it's the active tab
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      renderDashboard();
      updateDashboardStats();
    }
  });
}

function attachRemoveTaskBtn(btn) {
  btn.addEventListener('click', () => {
    const subId = btn.dataset.subid;
    const idx   = parseInt(btn.dataset.idx);
    const d = DATA[subId].marks;
    if (!d.tasks) return;
    d.tasks.splice(idx, 1);
    saveData();
    updateSubjectMarksBadge(subId);

    // Bug DASH-STALE fix: update dashboard if it's the active tab
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      renderDashboard();
      updateDashboardStats();
    }
    const grid = document.getElementById(`lab-tasks-grid-${subId}`);
    if (grid) {
      grid.innerHTML = d.tasks.length
        ? d.tasks.map((v, i) => buildMarkInput(subId, 'task', i, v, 10, `T${i+1}`)).join('')
        : '<div class="empty-msg" style="font-size:0.8rem;color:var(--text-muted);padding:4px 0;">No tasks yet — tap "+ Add Task" to add one.</div>';
      grid.querySelectorAll('.marks-input[data-type]').forEach(inp => attachSingleMarkInput(inp));
      grid.querySelectorAll('.btn-lab-remove-task').forEach(rb => attachRemoveTaskBtn(rb));
    }
  });
}

function attachRemoveVivaBtn(btn) {
  btn.addEventListener('click', () => {
    const subId = btn.dataset.subid;
    const idx   = parseInt(btn.dataset.idx);
    const d = DATA[subId].marks;
    if (!d.vivas) return;
    d.vivas.splice(idx, 1);
    saveData();
    updateSubjectMarksBadge(subId);

    // Bug DASH-STALE fix: update dashboard if it's the active tab
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      renderDashboard();
      updateDashboardStats();
    }
    const grid = document.getElementById(`lab-vivas-grid-${subId}`);
    if (grid) {
      grid.innerHTML = d.vivas.length
        ? d.vivas.map((v, i) => buildMarkInput(subId, 'viva', i, v, 10, `V${i+1}`)).join('')
        : '<div class="empty-msg" style="font-size:0.8rem;color:var(--text-muted);padding:4px 0;">No viva yet — tap "+ Add Viva" to add one.</div>';
      grid.querySelectorAll('.marks-input[data-type]').forEach(inp => attachSingleMarkInput(inp));
      grid.querySelectorAll('.btn-lab-remove-viva').forEach(rb => attachRemoveVivaBtn(rb));
    }
  });
}

function updateSubjectMarksBadge(subId) {
  const sub = SUBJECTS.find(s => s.id === subId);
  const pct = calcSubjectPct(DATA[subId].marks, sub);
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
  if (!DATA) return;

  SUBJECTS.forEach(sub => {
    if (!DATA[sub.id]) return; // skip if data key missing
    const d        = DATA[sub.id];
    const att      = d.attendance;
    const total    = att.present + att.absent + att.late;
    const pct      = calcAttPctStrict(att);
    const attColor = pct !== null ? (pct >= 75 ? 'green' : pct >= 65 ? 'amber' : 'red') : '';
    const barClass = pct === null ? '' : attColor === 'green' ? 'safe' : attColor === 'amber' ? 'warn' : 'danger';

    const card = document.createElement('div');
    card.className  = 'subject-card';
    card.dataset.id = sub.id;

    // Bug ESC-DASH fix: escape sub.code and sub.name in attendance card headers too.
    card.innerHTML = `
      <div class="card-header" role="button" aria-expanded="false" tabindex="0">
        <span class="card-code">${escHtml(sub.code)}</span>
        <span class="card-name">${escHtml(sub.name)}<small>${escHtml(String(sub.credits))} credit${sub.credits !== 1 ? 's' : ''}</small></span>
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
          <div class="att-pct-bar${barClass ? ' ' + barClass : ''}" id="att-bar-${sub.id}" style="width:${pct !== null ? Math.min(pct,100).toFixed(1) : 0}%"></div>
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

      // Bug DASH-STALE fix: update dashboard if it's the active tab
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        renderDashboard();
        updateDashboardStats();
      }
      const sub = SUBJECTS.find(s => s.id === subId);
      showToast(`✅ ${action.charAt(0).toUpperCase() + action.slice(1)} logged for ${sub ? sub.code : subId}`);
    });
  });

  document.querySelectorAll('.att-manual-input').forEach(inp => {
    inp.addEventListener('input', () => { // Fix: wrong event type
      const subId = inp.dataset.subid;
      const field = inp.dataset.field;
      let val   = Math.max(0, parseInt(inp.value) || 0);
      inp.value   = val;

      if (field === 'total') {
        const att = DATA[subId].attendance;
        const usedClasses = att.present + att.late;
        if (val < usedClasses) {
          val = usedClasses;
          inp.value = val;
          showToast(`⚠️ Total cannot be lower than Present + Late (${usedClasses}). Total adjusted to ${val}.`);
        }
        const absent = Math.max(0, val - att.present - att.late);
        DATA[subId].attendance.absent = absent;
        const absentInp = document.getElementById(`att-manual-absent-${subId}`);
        if (absentInp) absentInp.value = absent;
      } else {
        DATA[subId].attendance[field] = val;
        // Keep the total display in sync when present/absent/late changes directly
        const att = DATA[subId].attendance;
        const newTotal = att.present + att.absent + att.late;
        const totalInp = document.getElementById(`att-manual-total-${subId}`);
        if (totalInp) totalInp.value = newTotal;
      }

      saveData();
      updateAttCard(subId);

      // Bug DASH-STALE fix: update dashboard if it's the active tab
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        renderDashboard();
        updateDashboardStats();
      }
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
      const toast = document.getElementById('toast');
      clearTimeout(toast._timeout);
      const freshToast = toast.cloneNode(true);
      freshToast.id = 'toast';
      toast.parentNode.replaceChild(freshToast, toast);
      showToast(`🗑️ Attendance cleared for ${sub.code}. Tap to undo.`, 4000);
      const currentToast = document.getElementById('toast');
      const undoFn = () => {
        DATA[subId].attendance = backup;
        saveData();
        renderAttendance();
        showToast(`↩️ Undo successful for ${sub.code}`);
        currentToast.removeEventListener('click', undoFn);
      };
      currentToast.addEventListener('click', undoFn);
    });
  });
}

function updateAttCard(subId) {
  const att   = DATA[subId].attendance;
  const total = att.present + att.absent + att.late;
  const pct   = calcAttPctStrict(att);
  const attColor = pct !== null ? (pct >= 75 ? 'green' : pct >= 65 ? 'amber' : 'red') : '';
  const barClass = pct === null ? '' : attColor === 'green' ? 'safe' : attColor === 'amber' ? 'warn' : 'danger';

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
    barEl.className = 'att-pct-bar' + (barClass ? ' ' + barClass : '');
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
    if (isLabSubject(sub)) {
      return (m.tasks  && m.tasks.some(v => v !== null && v !== '')) ||
             (m.vivas  && m.vivas.some(v => v !== null && v !== '')) ||
             m.pbl !== null || m.oel !== null;
    }
    return m.quizzes.some(v => v !== null && v !== '') ||
           m.assignments.some(v => v !== null && v !== '') ||
           m.pbl !== null || m.mid !== null || m.finalObt !== null;
  }).length;
  document.getElementById('semester-progress-text').textContent =
    `Data entered for ${entered} of ${SUBJECTS.length} subjects · ${totalCredits()} total credits`;

  renderBarChart('chart-marks', SUBJECTS.map(sub => ({
    label: sub.code, pct: calcSubjectPct(DATA[sub.id].marks, sub)
  })));
  renderBarChart('chart-attendance', SUBJECTS.map(sub => ({
    label: sub.code, pct: calcAttPctStrict(DATA[sub.id].attendance)
  })));

  const strengthsEl = document.getElementById('strengths-list');
  strengthsEl.innerHTML = '';
  let hasStrength = false;
  SUBJECTS.forEach(sub => {
    const pct = calcSubjectPct(DATA[sub.id].marks, sub);
    if (pct !== null && pct >= 80) {
      hasStrength = true;
      strengthsEl.innerHTML += `<div class="sw-item green"><span class="sw-item-name">${escHtml(sub.code)} — ${escHtml(sub.name)}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasStrength) strengthsEl.innerHTML = '<div class="empty-msg">No subject ≥ 80% yet. Keep going! 💪</div>';

  const weaknessesEl = document.getElementById('weaknesses-list');
  weaknessesEl.innerHTML = '';
  let hasWeak = false;
  SUBJECTS.forEach(sub => {
    const pct = calcSubjectPct(DATA[sub.id].marks, sub);
    if (pct !== null && pct < 60) {
      hasWeak = true;
      weaknessesEl.innerHTML += `<div class="sw-item red"><span class="sw-item-name">${escHtml(sub.code)} — ${escHtml(sub.name)}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasWeak) weaknessesEl.innerHTML = '<div class="empty-msg">Nothing below 60%. Nice work! 🌟</div>';

  const attRiskEl = document.getElementById('att-risk-list');
  attRiskEl.innerHTML = '';
  let hasRisk = false;
  SUBJECTS.forEach(sub => {
    const pct = calcAttPctStrict(DATA[sub.id].attendance);
    if (pct !== null && pct < 75) {
      hasRisk = true;
      const cl = pct >= 65 ? 'amber' : 'red';
      attRiskEl.innerHTML += `<div class="sw-item ${cl}"><span class="sw-item-name">${escHtml(sub.code)} — ${escHtml(sub.name)}</span><span class="sw-item-pct">${pct.toFixed(1)}%</span></div>`;
    }
  });
  if (!hasRisk) attRiskEl.innerHTML = '<div class="empty-msg">All subjects above 75% ✅ Great attendance!</div>';

  const calcSubSel = document.getElementById('calc-subject');
  calcSubSel.innerHTML = SUBJECTS.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.code)} — ${escHtml(s.name)}</option>`).join('');
}

function renderBarChart(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<div class="empty-msg">No data entered yet.</div>';
    return;
  }
  el.innerHTML = '';

  items.forEach(item => {
    const pct       = item.pct;
    const isNoData  = pct === null || pct === undefined || isNaN(pct);
    const color     = isNoData ? 'no-data' : pct >= 75 ? 'bar-green' : pct >= 60 ? 'bar-amber' : 'bar-red';
    // Bug: no-data was 100% width (misleading full bar). Now 0%. Also clamp negative pct to 0.
    const width     = isNoData ? 0 : Math.min(Math.max(pct, 0), 100).toFixed(1);

    el.innerHTML += `
      <div class="bar-row">
        <span class="bar-label">${escHtml(item.label)}</span>
        <div class="bar-track">
          <div class="bar-fill ${color}" style="width:${width}%">
            ${!isNoData && pct >= 15 ? `<span class="bar-pct">${pct.toFixed(0)}%</span>` : ''}
          </div>
        </div>
        <span class="bar-val">${!isNoData ? pct.toFixed(0) + '%' : '—'}</span>
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

    if (!subId || isNaN(targetPct)) { resultEl.style.color = ''; resultEl.textContent = 'Please select a subject and target grade.'; return; }
    if (isNaN(finalTotal) || finalTotal <= 0) { resultEl.style.color = ''; resultEl.textContent = 'Please enter the final exam total marks.'; return; }
    if (targetPct < 0 || targetPct > 100) { resultEl.style.color = 'var(--red)'; resultEl.textContent = 'Target percentage must be between 0 and 100.'; return; }

    const sub = SUBJECTS.find(s => s.id === subId);
    if (!sub || !DATA[subId]) { resultEl.style.color = 'var(--red)'; resultEl.textContent = 'Subject data not found. Try refreshing.'; return; }
    const d   = DATA[subId].marks;

    if (isLabSubject(sub)) {
      resultEl.style.color = 'var(--amber)';
      resultEl.textContent = 'ℹ️ Lab subjects do not have a final exam. Use the Marks tab to see your current lab percentage.';
      return;
    }

    if (d.finalObt !== null && d.finalTotal !== null) {
      const currentPct = calcSubjectPct(d, sub);
      const currentGrade = pctToGrade(currentPct);
      resultEl.textContent = `Final exam marks are already entered. Current grade: ${currentGrade.grade} (${currentPct !== null ? currentPct.toFixed(1) + '%' : 'N/A'})`;
      resultEl.style.color = '';
      return;
    }
    // Each component contributes its earned share on a 0–100 scale.
    // weightedSum = earned points from non-final components (max 55).
    // Final is worth 45%. Formula: requiredFinalPct = (targetPct - weightedSum) / 0.45
    let weightedSum = 0;
    let totalEnteredWeight = 0;
    const quizVals = d.quizzes.filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
    if (quizVals.length > 0) {
      weightedSum += (quizVals.reduce((a,b)=>a+b,0) / (quizVals.length * 10)) * 15;
      totalEnteredWeight += 15;
    }

    const assVals = d.assignments.filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).map(Number);
    if (assVals.length > 0) {
      weightedSum += (assVals.reduce((a,b)=>a+b,0) / (assVals.length * 10)) * 10;
      totalEnteredWeight += 10;
    }

    const pbl = normalizeMark(d.pbl, 10);
    if (pbl !== null) { weightedSum += (pbl/10)*5; totalEnteredWeight += 5; }
    const oel = normalizeMark(d.oel, 10);
    if (oel !== null) { weightedSum += (oel/10)*5; totalEnteredWeight += 5; }
    const mid = normalizeMark(d.mid, 25);
    if (mid !== null) { weightedSum += (mid/25)*25; totalEnteredWeight += 25; }

    // weightedSum is now the student's earned % points from non-final components (max 55).
    // Final is worth 45%. Solve for required final percentage:
    const finalWeight      = 45;
    const requiredFinalPct = (targetPct - weightedSum) / (finalWeight / 100);
    const requiredMarks    = (requiredFinalPct / 100) * finalTotal;
    const g = pctToGrade(targetPct);

    // Bug SS fix: build result with DOM nodes — no user data interpolated into innerHTML.
    resultEl.textContent = '';
    resultEl.style.color = '';

    const epsilon = 1e-6;
    if (requiredFinalPct <= 0) {
      resultEl.textContent = `🎉 You've already secured ${g.grade} for ${sub.code} regardless of the final!`;
      resultEl.style.color = 'var(--green)';
    } else if (requiredFinalPct > 100) {
      resultEl.textContent = `❌ Even 100% on the final won't achieve ${g.grade} for ${sub.code} with your current marks.`;
      resultEl.style.color = 'var(--red)';
    } else if (requiredFinalPct > 100 - epsilon) {
      // Effectively needs a perfect score
      resultEl.textContent = `💪 You need a perfect score (${finalTotal}/${finalTotal}) on the final to earn ${g.grade} in ${sub.code}.`;
      resultEl.style.color = 'var(--amber)';
    } else {
      const msg = document.createDocumentFragment();
      const append = (text, bold) => {
        if (bold) {
          const s = document.createElement('strong');
          s.textContent = text;
          msg.appendChild(s);
        } else {
          msg.appendChild(document.createTextNode(text));
        }
      };
      append('To get ', false);
      append(g.grade, true);
      append(' in ', false);
      append(sub.code, true);
      append(', score at least ', false);
      append(`${requiredMarks.toFixed(1)} / ${finalTotal}`, true);
      append(` on the final (${requiredFinalPct.toFixed(1)}%).`, false);
      if (totalEnteredWeight < 55) {
        msg.appendChild(document.createElement('br'));
        append('⚠️ Assumes 0% for unentered components.', false);
      }
      resultEl.appendChild(msg);
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
    DATA = initData([], {});
    setupWizard();
    showSetup();
  } else {
    DATA     = saved;
    SUBJECTS = DATA._subjects || DEFAULT_SUBJECTS;
    if (!DATA._subjects) {
      DATA._subjects = DEFAULT_SUBJECTS;
      SUBJECTS = DEFAULT_SUBJECTS;
    }
    migrateData(DATA);
    setupWizard();
    hideSetup();
    applyTheme(DATA._meta.theme || 'light');
    updateNavLabel();
    saveData();
    renderAll();
  }

  setupTheme();
  setupTabs();
  setupDataControls();
  setupCalculator();
});
