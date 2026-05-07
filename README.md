# GradeFlow — Student Semester Tracker

> Track your grades, attendance, and GPA — all in your browser. No backend. No login. No install.

**Live Demo → [zafarikomail-cmd.github.io/Grade-FLow](https://zafarikomail-cmd.github.io/Grade-FLow)**

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-blue?style=flat)

---

## Overview

GradeFlow is a lightweight, offline-ready web app built for students who want a clean and fast way to stay on top of their semester. Enter your marks and attendance, watch your GPA update instantly, and find out exactly what you need to score on your final exam — all without creating an account or installing anything.

---

## Features

| Feature | Description |
|---|---|
| 📊 **Marks Tracker** | Quizzes, assignments, PBL, OEL, midterm & final for regular subjects; tasks, vivas, OEL & PBL for lab subjects |
| 📅 **Attendance Tracker** | Log present / absent / late with one tap, plus manual override |
| 📈 **Analyze Page** | Live GPA, bar charts, strengths & weaknesses, attendance risk flags |
| 🎯 **Final Exam Calculator** | Enter your target grade — get the exact score you need on the final |
| 🌙 **Dark / Light Mode** | Clean dark theme, system-aware toggle |
| 💾 **Auto-Save** | All data persists in browser localStorage automatically |
| 📤 **Excel Export** | Export your full semester data as a styled `.xlsx` file |
| 🔁 **JSON Backup & Restore** | Export and re-import a full data backup anytime |
| 📱 **Mobile-First Design** | Optimized for phone use, works great on desktop too |
| ⚡ **Zero Dependencies** | Pure HTML, CSS, and JavaScript — no frameworks, no build step |

---

## Getting Started

**Option 1 — Live version**

Visit the live app directly:
[zafarikomail-cmd.github.io/Grade-FLow](https://zafarikomail-cmd.github.io/Grade-FLow)

**Option 2 — Run locally**

```bash
git clone https://github.com/zafarikomail-cmd/Grade-FLow.git
cd Grade-FLow
# Open index.html in any browser — no server needed
```

---

## Project Structure

```
Grade-FLow/
├── index.html    # App shell, setup wizard, page layouts
├── styles.css    # Full light/dark theme, responsive layout
└── app.js        # All logic — marks, attendance, GPA, charts, export
```

---

## Default Subjects

The app ships with a preset for **NUTECH CS Spring 2026**. You can replace these with your own subjects during the first-launch setup wizard.

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

> Lab subjects are auto-detected by the word "Lab" in the subject name, or can be flagged manually with `isLab: true`.

---

## Grading Scale

| Grade | Points | Minimum % |
|-------|--------|-----------|
| A     | 4.0    | 90%       |
| A−    | 3.7    | 85%       |
| B+    | 3.3    | 80%       |
| B     | 3.0    | 75%       |
| B−    | 2.7    | 70%       |
| C+    | 2.3    | 65%       |
| C     | 2.0    | 60%       |
| C−    | 1.7    | 55%       |
| D+    | 1.3    | 50%       |
| D     | 1.0    | 45%       |
| F     | 0.0    | < 45%     |

---

## Marks Weightage

### Regular Subjects

| Component          | Weight | Max Marks  |
|--------------------|--------|------------|
| Quizzes (average)  | 15%    | 10 each    |
| Assignments (avg)  | 10%    | 10 each    |
| PBL                | 5%     | 10         |
| OEL                | 5%     | 10         |
| Mid Exam           | 25%    | 25         |
| Final Exam         | 45%    | Variable   |

### Lab Subjects

| Component        | Weight |
|------------------|--------|
| Tasks (average)  | 50%    |
| Vivas (average)  | 20%    |
| OEL              | 15%    |
| PBL              | 15%    |

> Components with no data entered are excluded from the weighted average, so your percentage reflects only what you've filled in.

---

## Changelog

### v2.0 — Bug Fix Release

Six bugs identified and resolved in this release.

**1. Missing hidden file input — import crash (Critical)**
The import button called `.click()` on a `#import-file` element that didn't exist in the HTML, causing a hard crash. Fixed by adding the missing hidden `<input type="file">` element.

**2. Final exam calculator: inverted epsilon boundary (Medium)**
The "perfect score required" branch used `<= 100 + epsilon` as its upper bound, making the "impossible to pass" branch unreachable for values just above 100. Boundary corrected to `<= 100`.

**3. Attendance manual input: wrong event type (Medium)**
Manual attendance inputs used the `change` event (fires on blur only), while marks inputs used `input` (fires on every keystroke). The attendance bar would not update live while typing. Corrected to use `input`.

**4. Lab percentage double-scaling (Low)**
Lab subject totals were divided by `weightTotal` and then multiplied by 100 again, producing inflated percentages (e.g. 500% instead of 50%). Fixed to return the correctly pre-scaled value.

**5. Toast `id` lost after undo clone (Low)**
After cloning the toast element to reset its undo listener, the cloned node lost its `id`, causing all subsequent `showToast()` calls to silently fail. Fixed by re-assigning `freshToast.id = 'toast'` after the clone.

**6. Green attendance bar not visible (Low)**
The attendance progress bar had no fill color when attendance was ≥ 75%. The `barClass` was set to an empty string for the green/safe state and no matching CSS rule existed. Fixed by adding the `.safe` modifier class and a corresponding CSS rule.

---

## Built With

- [Sora](https://fonts.google.com/specimen/Sora) — UI typeface
- [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — monospace inputs
- No frameworks. No libraries. No build tools.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

*Made for students, by a student.*
