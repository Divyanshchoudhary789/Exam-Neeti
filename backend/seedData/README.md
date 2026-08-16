# Question Bank Seeding Pipeline

End-to-end guide: Word file → JSON → Images extracted → DB seeded.

---

## Folder Structure

```
backend/
  seedData/
    questions/
      _template.json              ← copy this for every new paper
      physics_xi_minor1.json      ← sample: Minor 1 Physics XI
    images/
      questions/                  ← extracted/placed images for question bodies
      solutions/                  ← extracted/placed images for solutions
  scripts/
    extractDocx.js                ← Step 1: extract images from .docx
    seedQuestions.js              ← Step 3: seed JSON into MongoDB
```

---

## One-time Setup

```bash
# 1. Install dependencies (already done if you ran npm install)
npm install

# 2. Add Cloudinary keys to your .env file
#    Get from: cloudinary.com → Dashboard → API Keys
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Pipeline — Every Time You Get a New Paper

### STEP 1 — Extract Images from Word File

```bash
node scripts/extractDocx.js --file "path/to/QuestionPaper.docx" --prefix physics_xi_minor1
```

- Images will be saved to `seedData/images/questions/physics_xi_minor1_img_001.png`, `_002.png`, etc.
- Open the original .docx side by side and note which image belongs to which question number.

**If the .docx is in a different folder:**
```bash
node scripts/extractDocx.js --file "D:/Papers/Minor1Physics.docx" --prefix physics_xi_minor1
```

---

### STEP 2 — Create / Fill JSON File (Manual)

1. Copy `seedData/questions/_template.json` → rename it (e.g. `physics_xi_minor2.json`)
2. Fill each question:
   - Copy question text from Word
   - Map options: (1)→A, (2)→B, (3)→C, (4)→D
   - Map difficulty: Easy→`easy`, Medium→`medium`, Hard→`hard`
   - Set `correctAnswer` to `A`/`B`/`C`/`D`
   - For questions WITH diagrams, set `localPath`:
     ```json
     "questionImage": { "localPath": "seedData/images/questions/physics_xi_minor1_img_001.png" }
     ```
   - For questions WITHOUT images, keep `localPath` as `null`

**Field reference:**
| JSON field | Source in paper | Example |
|---|---|---|
| `subject` | Field → Subject | `"physics"` |
| `classLevel` | Field → Class | `"XI"` |
| `chapter` | Field → Chapter | `"Vectors..."` |
| `topic` | Field → Concept | `"Multiplication of vectors"` |
| `questionCategory` | Question type | `"Cross-product of vectors"` |
| `questionVariant` | Variant | `"Rectangular component form"` |
| `difficulty` | Difficulty | `"medium"` |
| `idealTimeSeconds` | Ideal time | `40` |
| `text` | Question text | full text |
| `correctAnswer` | Sol. answer (1→A) | `"C"` |
| `solution.text` | Solution body | full solution |

---

### STEP 3 — Dry Run (Validate Before Seeding)

```bash
node scripts/seedQuestions.js --file seedData/questions/physics_xi_minor1.json --dry-run
```

This validates all 45 questions without touching DB or Cloudinary. Fix any errors shown.

---

### STEP 4 — Seed to Database

```bash
node scripts/seedQuestions.js --file seedData/questions/physics_xi_minor1.json
```

Or using the npm shortcut:
```bash
npm run seed:questions -- --file seedData/questions/physics_xi_minor1.json
```

**What happens:**
- Each question gets a SHA-256 `contentHash` (subject+class+chapter+topic+text)
- If that hash already exists in DB → **skipped** (no duplicates ever)
- If `localPath` is set → image uploaded to Cloudinary → URL stored in DB
- Question inserted with all fields

**Sample output:**
```
[Seed] Questions: 45
[Seed] Validating... ✔

  Q001 ✔  Inserted — A body is rotating with angular velocity...
  Q002 ✔  Inserted — If force F makes a displacement...
  Q003 SKIP  (duplicate) — The sum of two vectors...

╔═══════════════════════════════════════════╗
║  Total    : 45                            ║
║  Inserted : 44                            ║
║  Skipped  : 1                             ║
║  Errors   : 0                             ║
╚═══════════════════════════════════════════╝
```

---

## Quick Reference — All Commands

```bash
# Extract images from Word file
node scripts/extractDocx.js --file "MyPaper.docx" --prefix subject_class_papername

# Validate JSON (no DB writes)
node scripts/seedQuestions.js --file seedData/questions/my_paper.json --dry-run

# Seed to DB
node scripts/seedQuestions.js --file seedData/questions/my_paper.json
```

---

## Rules

1. **Never edit contentHash manually** — it is auto-computed.
2. **Always dry-run first** before seeding a new file.
3. **Images are optional** — if a question has no diagram, leave `localPath: null`.
4. **Correct answer must be A/B/C/D** not 1/2/3/4.
5. **difficulty must be lowercase** — `easy`, `medium`, `hard`.
6. **sourceRef** should be the same for all questions in one paper.
