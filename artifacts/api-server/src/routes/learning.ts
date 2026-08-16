import { Router, type IRouter } from "express";
import { and, desc, eq, lte } from "drizzle-orm";
import {
  CreatePracticeAttemptBody,
  CreatePracticeAttemptResponse,
  CreateWordSetBody,
  CreateWordSetResponse,
  DeleteWordSetParams,
  GetDashboardResponse,
  GetProfileResponse,
  GetReviewResponse,
  GetWordParams,
  GetWordResponse,
  GetWordSetParams,
  GetWordSetResponse,
  ListWordSetsResponse,
  UpdateWordSetBody,
  UpdateWordSetParams,
  UpdateWordSetResponse,
} from "@workspace/api-zod";
import {
  db,
  practiceAttemptsTable,
  profilesTable,
  reviewsTable,
  wordSetsTable,
  wordsTable,
} from "@workspace/db";

const router: IRouter = Router();
const DEMO_USER_ID = "demo-user";
let demoReady = false;

const examples: Record<string, { meaning: string; pronunciation: string; sentence: string }> = {
  improve: {
    meaning: "to become better",
    pronunciation: "/ɪmˈpruːv/",
    sentence: "I want to improve my English.",
  },
  achieve: {
    meaning: "to successfully reach a goal",
    pronunciation: "/əˈtʃiːv/",
    sentence: "Small steps help me achieve my goals.",
  },
  effort: {
    meaning: "the energy used to do something",
    pronunciation: "/ˈefərt/",
    sentence: "Every effort makes the next step easier.",
  },
  discipline: {
    meaning: "the habit of doing what needs to be done",
    pronunciation: "/ˈdɪsəplɪn/",
    sentence: "Discipline keeps my practice consistent.",
  },
  consistent: {
    meaning: "done in the same reliable way",
    pronunciation: "/kənˈsɪstənt/",
    sentence: "Consistent practice creates real progress.",
  },
  curious: {
    meaning: "wanting to learn or know more",
    pronunciation: "/ˈkjʊəriəs/",
    sentence: "Stay curious when a new word feels difficult.",
  },
  explore: {
    meaning: "to look around and learn about something",
    pronunciation: "/ɪkˈsplɔːr/",
    sentence: "I love to explore new places and ideas.",
  },
  prepare: {
    meaning: "to get ready for something",
    pronunciation: "/prɪˈpeər/",
    sentence: "I prepare a little before every lesson.",
  },
};

function wordDetails(text: string) {
  const clean = text.trim().toLowerCase();
  return examples[clean] ?? {
    meaning: `to understand and use "${clean}" in context`,
    pronunciation: `/${clean}/`,
    sentence: `I am learning how to use ${clean} naturally.`,
  };
}

function statusForMastery(mastery: number) {
  if (mastery >= 90) return "Mastered";
  if (mastery >= 72) return "Strong";
  if (mastery >= 48) return "Familiar";
  if (mastery > 0) return "Learning";
  return "New";
}

async function ensureDemoData() {
  if (demoReady) return;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID));
  if (!profile) {
    await db.insert(profilesTable).values({ userId: DEMO_USER_ID });
  }

  const sets = await db.select().from(wordSetsTable).where(eq(wordSetsTable.userId, DEMO_USER_ID));
  if (sets.length === 0) {
    const [set] = await db
      .insert(wordSetsTable)
      .values({ userId: DEMO_USER_ID, name: "Personal Growth", lastPracticed: new Date() })
      .returning();
    if (set) {
      const seedWords = ["improve", "achieve", "effort", "discipline", "consistent"];
      await db.insert(wordsTable).values(
        seedWords.map((text, index) => {
          const details = wordDetails(text);
          const mastery = [82, 68, 75, 41, 58][index] ?? 18;
          return {
            setId: set.id,
            text,
            ...details,
            mastery,
            status: statusForMastery(mastery),
            writing: [90, 64, 78, 31, 54][index] ?? 0,
            speaking: [74, 62, 71, 44, 58][index] ?? 0,
            recall: [81, 69, 76, 47, 61][index] ?? 0,
            attempts: index + 3,
            mistakes: index === 3 ? 3 : 1,
            nextReview: new Date(Date.now() - (index < 3 ? 60_000 : -86_400_000)),
          };
        }),
      );
    }
  }
  demoReady = true;
}

async function getSetPayload(setId: number) {
  const [set] = await db.select().from(wordSetsTable).where(
    and(eq(wordSetsTable.id, setId), eq(wordSetsTable.userId, DEMO_USER_ID)),
  );
  if (!set) return null;
  const words = await db.select().from(wordsTable).where(eq(wordsTable.setId, set.id)).orderBy(wordsTable.id);
  const mastery = words.length ? Math.round(words.reduce((total, word) => total + word.mastery, 0) / words.length) : 0;
  const dueCount = words.filter((word) => word.nextReview <= new Date()).length;
  return {
    id: set.id,
    name: set.name,
    wordCount: words.length,
    mastery,
    dueCount,
    lastPracticed: set.lastPracticed,
    words,
  };
}

async function getSetSummaries() {
  const sets = await db.select().from(wordSetsTable)
    .where(eq(wordSetsTable.userId, DEMO_USER_ID))
    .orderBy(desc(wordSetsTable.lastPracticed), desc(wordSetsTable.createdAt));
  const summaries = [];
  for (const set of sets) {
    const payload = await getSetPayload(set.id);
    if (payload) {
      const { words: _words, ...summary } = payload;
      summaries.push(summary);
    }
  }
  return summaries;
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureDemoData();
  const summaries = await getSetSummaries();
  const dueWords = await db.select().from(wordsTable).where(lte(wordsTable.nextReview, new Date()));
  const profile = (await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID)))[0];
  const reviewItems = Math.max(dueWords.length * 2, 0);
  res.json(GetDashboardResponse.parse({
    greeting: "Good afternoon",
    minutesLearned: profile?.minutesLearned ?? 0,
    dailyGoal: profile?.dailyGoal ?? 15,
    streak: profile?.currentStreak ?? 0,
    reviewItems,
    reviewBreakdown: {
      words: dueWords.length,
      sentences: dueWords.length ? Math.max(1, Math.floor(dueWords.length * 0.75)) : 0,
      writing: dueWords.filter((word) => word.writing < 70).length,
      speaking: dueWords.filter((word) => word.speaking < 70).length,
    },
    continueSet: summaries[0] ?? null,
    recentSets: summaries.slice(0, 3),
  }));
});

router.get("/profile", async (_req, res): Promise<void> => {
  await ensureDemoData();
  const profile = (await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID)))[0];
  const words = await db.select().from(wordsTable);
  const attempts = await db.select().from(practiceAttemptsTable);
  const overallProgress = words.length ? Math.round(words.reduce((total, word) => total + word.mastery, 0) / words.length) : 0;
  res.json(GetProfileResponse.parse({
    overallProgress,
    wordsLearned: words.filter((word) => word.mastery >= 70).length,
    sentencesPracticed: attempts.filter((attempt) => attempt.skill === "recall" || attempt.skill === "sentence_usage").length,
    speakingPractice: attempts.filter((attempt) => attempt.skill === "speaking").length,
    writingPractice: attempts.filter((attempt) => attempt.skill === "writing").length,
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    dailyGoal: profile?.dailyGoal ?? 15,
    achievements: [
      ...(attempts.length >= 1 ? ["First practice"] : []),
      ...(words.length >= 5 ? ["Five words in motion"] : []),
      ...(overallProgress >= 70 ? ["Building fluency"] : []),
    ],
  }));
});

router.get("/word-sets", async (_req, res): Promise<void> => {
  await ensureDemoData();
  res.json(ListWordSetsResponse.parse(await getSetSummaries()));
});

router.post("/word-sets", async (req, res): Promise<void> => {
  const parsed = CreateWordSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const words = [...new Set(parsed.data.words.map((word) => word.trim().toLowerCase()).filter(Boolean))];
  if (words.length < 4) {
    res.status(400).json({ error: "Add at least four unique words." });
    return;
  }
  const set = await db.transaction(async (tx) => {
    const [set] = await tx.insert(wordSetsTable).values({
      userId: DEMO_USER_ID,
      name: parsed.data.name.trim(),
      lastPracticed: new Date(),
    }).returning();
    if (!set) throw new Error("Unable to create word set");
    await tx.insert(wordsTable).values(words.map((text) => {
      const details = wordDetails(text);
      return { setId: set.id, text, ...details };
    }));
    return set;
  });
  const payload = set ? await getSetPayload(set.id) : null;
  res.status(201).json(CreateWordSetResponse.parse(payload));
});

router.get("/word-sets/:setId", async (req, res): Promise<void> => {
  const params = GetWordSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureDemoData();
  const payload = await getSetPayload(params.data.setId);
  if (!payload) {
    res.status(404).json({ error: "Word set not found" });
    return;
  }
  res.json(GetWordSetResponse.parse(payload));
});

router.patch("/word-sets/:setId", async (req, res): Promise<void> => {
  const params = UpdateWordSetParams.safeParse(req.params);
  const body = UpdateWordSetBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [set] = await db.update(wordSetsTable)
    .set({ name: body.data.name.trim(), updatedAt: new Date() })
    .where(and(eq(wordSetsTable.id, params.data.setId), eq(wordSetsTable.userId, DEMO_USER_ID)))
    .returning();
  if (!set) {
    res.status(404).json({ error: "Word set not found" });
    return;
  }
  const payload = await getSetPayload(set.id);
  res.json(UpdateWordSetResponse.parse(payload));
});

router.delete("/word-sets/:setId", async (req, res): Promise<void> => {
  const params = DeleteWordSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [set] = await db.delete(wordSetsTable)
    .where(and(eq(wordSetsTable.id, params.data.setId), eq(wordSetsTable.userId, DEMO_USER_ID)))
    .returning();
  if (!set) {
    res.status(404).json({ error: "Word set not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/words/:wordId", async (req, res): Promise<void> => {
  const params = GetWordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, params.data.wordId));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  res.json(GetWordResponse.parse(word));
});

router.get("/review", async (_req, res): Promise<void> => {
  await ensureDemoData();
  const dueWords = await db.select().from(wordsTable).where(lte(wordsTable.nextReview, new Date()));
  const total = dueWords.length * 2;
  res.json(GetReviewResponse.parse({
    total,
    words: dueWords.length,
    sentences: dueWords.length,
    writing: dueWords.filter((word) => word.writing < 70).length,
    speaking: dueWords.filter((word) => word.speaking < 70).length,
    recall: dueWords.filter((word) => word.recall < 70).length,
    forms: 0,
  }));
});

router.post("/practice-attempts", async (req, res): Promise<void> => {
  const parsed = CreatePracticeAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, parsed.data.wordId));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  const [attempt] = await db.insert(practiceAttemptsTable).values({
    wordId: word.id,
    skill: parsed.data.skill,
    correct: parsed.data.correct,
    answer: parsed.data.answer ?? null,
  }).returning();
  if (!attempt) {
    res.status(400).json({ error: "Unable to record attempt" });
    return;
  }
  const skillColumn = parsed.data.skill === "writing" ? word.writing : parsed.data.skill === "speaking" ? word.speaking : word.recall;
  const nextSkillScore = Math.max(0, Math.min(100, skillColumn + (parsed.data.correct ? 10 : -4)));
  const nextMastery = Math.max(0, Math.min(100, Math.round(word.mastery * 0.7 + nextSkillScore * 0.3)));
  const nextReview = new Date(Date.now() + (parsed.data.correct ? 3 : 1) * 86_400_000);
  const update = {
    mastery: nextMastery,
    status: statusForMastery(nextMastery),
    attempts: word.attempts + 1,
    mistakes: word.mistakes + (parsed.data.correct ? 0 : 1),
    lastReviewed: new Date(),
    nextReview,
    ...(parsed.data.skill === "writing" ? { writing: nextSkillScore } : {}),
    ...(parsed.data.skill === "speaking" ? { speaking: nextSkillScore } : {}),
    ...(parsed.data.skill === "recall" ? { recall: nextSkillScore } : {}),
  };
  await db.update(wordsTable).set(update).where(eq(wordsTable.id, word.id));
  await db.update(wordSetsTable).set({ lastPracticed: new Date(), updatedAt: new Date() }).where(eq(wordSetsTable.id, word.setId));
  res.status(201).json(CreatePracticeAttemptResponse.parse({
    id: attempt.id,
    wordId: word.id,
    skill: parsed.data.skill,
    correct: parsed.data.correct,
    createdAt: attempt.createdAt,
    mastery: nextMastery,
  }));
});

export default router;