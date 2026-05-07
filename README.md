# 🎓 GradeFlow — Student Semester Tracker

A clean, mobile-friendly web app to track your **grades, attendance, and GPA** — all in your browser. No backend, no login, no install.

**Live Demo → [zafarikomail-cmd.github.io/Grade-FLow](https://zafarikomail-cmd.github.io/Grade-FLow)**

---

## ✨ Features

- 📊 **Marks Tracker** — Quizzes, Assignments, PBL, OEL, Midterm & Final (regular subjects) + Tasks, Vivas, OEL & PBL (lab subjects)
- 📅 **Attendance Tracker** — Present / Absent / Late logging with manual override
- 📈 **Analyze Page** — GPA, bar charts, strengths & weaknesses, attendance risk
- 🎯 **Final Exam Calculator** — Find exactly what you need to score to hit your target grade
- 🌙 **Dark / Light Mode** — Clean dark theme, no pink involved
- 💾 **Local Storage** — Data saves in your browser automatically
- 📱 **Mobile Friendly** — Works great on phone & desktop
- ⚡ **Zero Dependencies** — Pure HTML, CSS, JavaScript
- 📤 **Excel Export** — Export your full semester data as a styled `.xlsx` file
- 💾 **JSON Backup & Import** — Export/import a full data backup

---

## 🚀 Getting Started

Just open `index.html` in any browser — that's it.

Or visit the live GitHub Pages link above.

---

## 🗂️ Project Structure

```
Grade-FLow/
├── index.html    # App structure & setup wizard
├── styles.css    # Full light/dark theme styling
└── app.js        # All logic — marks, attendance, GPA, charts, export
```

---

## 🏫 Default Subjects (NUTECH CS Spring 2026)

| Code  | Subject                        | Credits | Type    |
|-------|--------------------------------|---------|---------|
| GE121 | Calculus & Analytical Geometry | 3       | Regular |
| CS160 | Database Systems               | 3       | Regular |
| CS161 | Database Systems Lab           | 1       | Lab     |
| CS122 | Object Oriented Programming    | 3       | Regular |
| CS123 | OOP Lab                        | 1       | Lab     |
| CS130 | Digital Logic Design           | 2       | Regular |
| CS131 | Digital Logic Design Lab       | 1       | Lab     |
| MT220 | Probability & Statistics       | 3       | Regular |
| GE231 | Fehm-e-Quran I                 | 1       | Regular |

> You can fully customize subjects during the setup wizard. Lab subjects are auto-detected by the word "Lab" in the name, or you can set `isLab: true` manually.

---

## 📐 Grading Scale

| Grade | Points | Percentage |
|-------|--------|------------|
| A     | 4.0    | ≥ 90%      |
| A-    | 3.7    | ≥ 85%      |
| B+    | 3.3    | ≥ 80%      |
| B     | 3.0    | ≥ 75%      |
| B-    | 2.7    | ≥ 70%      |
| C+    | 2.3    | ≥ 65%      |
| C     | 2.0    | ≥ 60%      |
| C-    | 1.7    | ≥ 55%      |
| D+    | 1.3    | ≥ 50%      |
| D     | 1.0    | ≥ 45%      |
| F     | 0.0    | < 45%      |

---

## ⚖️ Marks Weightage

### Regular Subjects
| Component       | Weight | Out of |
|----------------|--------|--------|
| Quizzes (avg)  | 15%    | 10 each |
| Assignments (avg) | 10% | 10 each |
| PBL            | 5%     | 10      |
| OEL            | 5%     | 10      |
| Mid Exam       | 25%    | 25      |
| Final Exam     | 45%    | Variable |

### Lab Subjects
| Component      | Weight |
|----------------|--------|
| Tasks (avg)    | 50%    |
| Vivas (avg)    | 20%    |
| OEL            | 15%    |
| PBL            | 15%    |

> Components with no data entered are excluded from the weighted average, so your percentage updates live as you fill in marks.

---

## 🛠️ Built With

- Vanilla HTML / CSS / JavaScript
- [Sora](https://fonts.google.com/specimen/Sora) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — Google Fonts
- No frameworks. No libraries. No nonsense.

---

## 🐛 Changelog

### v2 — Bug Fix Release

Six bugs identified and resolved:

1. **Lab percentage double-scaling** — Lab subject totals were being divided by `weightTotal` and then multiplied by 100 again, producing inflated percentages (e.g. 500% instead of 50%). Fixed to return the correctly pre-scaled `weightedSum` directly.

2. **Final exam calculator wrong formula** — The required final score formula mixed weighted points with raw percentages, producing incorrect results. Rewritten to correctly back-calculate the needed final exam percentage from current weighted progress.

3. **Toast `id` lost after undo clone** — After cloning the toast element to reset its event listeners (used for undo), the cloned node lost its `id`, causing all subsequent `showToast()` calls to crash silently. Fixed by explicitly re-setting `freshToast.id = 'toast'` after the clone.

4. **Attendance toast showed raw database key** — Logging attendance displayed the internal storage key (e.g. `CS160_0`) in the toast instead of the human-readable subject code (e.g. `CS160`). Fixed to look up and display `sub.code`.

5. **`setupTheme()` crash on null DATA** — `DATA._meta.theme` threw a TypeError when `DATA` was null in certain first-load edge cases. Added a null-safe guard.

6. **Green attendance bar invisible** — The attendance progress bar had no color when attendance was ≥ 75% (green). The `barClass` was set to an empty string for the green state, and no matching CSS rule existed. Fixed by adding a `.safe` modifier class and the corresponding CSS rule `background: var(--green)`.

---

## 📄 License

MIT — free to use, modify, and share.

---

*Made for students, by a student.*
