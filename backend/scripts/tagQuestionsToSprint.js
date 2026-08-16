/**
 * tagQuestionsToSprint.js  [DEPRECATED — no longer needed]
 *
 * As of the attribute-based reconstruction update, manual sprint tagging is no
 * longer required. The reconstruction engine now selects questions purely by
 * their natural attributes (subject / chapter / difficulty / topic).
 *
 * Questions with empty patternSlotTags are treated as "open pool" and are
 * automatically eligible for every sprint. This is the default state of all
 * newly seeded questions.
 *
 * NEW WORKFLOW (no extra steps):
 *   1. node scripts/seedQuestions.js --file <file>   ← seed questions once
 *   2. POST /api/v1/sprints                          ← create sprint any time
 *   3. POST /api/v1/exams                            ← generate exam immediately
 *
 * patternSlotTags still exist on the Question model and can be used if you ever
 * need to hard-restrict a specific question to a specific sprint+slot. That is
 * an advanced opt-in feature — the system works correctly without it.
 *
 * This file is kept for historical reference and can be safely deleted.
 */

console.log(
  "\n[Tag] This script is no longer needed.\n" +
  "      Questions are now eligible for all sprints by default.\n" +
  "      See script header for the new workflow.\n"
);
process.exit(0);
