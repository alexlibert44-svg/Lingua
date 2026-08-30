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
  UpdateProfileBody,
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

const translations: Record<string, Record<string, { word: string; sentence: string }>> = {
  en: {
    improve: { word: "improve", sentence: "I want to improve my English." },
    achieve: { word: "achieve", sentence: "Small steps help me achieve my goals." },
    effort: { word: "effort", sentence: "Every effort makes the next step easier." },
    discipline: { word: "discipline", sentence: "Discipline keeps my practice consistent." },
    consistent: { word: "consistent", sentence: "Consistent practice creates real progress." },
    curious: { word: "curious", sentence: "Stay curious when a new word feels difficult." },
    explore: { word: "explore", sentence: "I love to explore new places and ideas." },
    prepare: { word: "prepare", sentence: "I prepare a little before every lesson." },
  },
  fr: {
    improve: { word: "s’améliorer", sentence: "Je veux améliorer mon anglais." },
    achieve: { word: "atteindre / réussir", sentence: "Les petits pas m’aident à atteindre mes objectifs." },
    effort: { word: "effort", sentence: "Chaque effort rend l’étape suivante plus facile." },
    discipline: { word: "discipline", sentence: "La discipline rend ma pratique régulière." },
    consistent: { word: "régulier", sentence: "Une pratique régulière crée de vrais progrès." },
    curious: { word: "curieux", sentence: "Restez curieux quand un nouveau mot semble difficile." },
    explore: { word: "explorer", sentence: "J’aime explorer de nouveaux lieux et de nouvelles idées." },
    prepare: { word: "préparer", sentence: "Je me prépare un peu avant chaque leçon." },
  },
  ar: {
    improve: { word: "يتحسن", sentence: "أريد أن أحسّن لغتي الإنجليزية." },
    achieve: { word: "يحقق / ينجز", sentence: "تساعدني الخطوات الصغيرة على تحقيق أهدافي." },
    effort: { word: "جهد", sentence: "كل جهد يجعل الخطوة التالية أسهل." },
    discipline: { word: "انضباط", sentence: "يحافظ الانضباط على انتظام تدرّبي." },
    consistent: { word: "منتظم", sentence: "يُحدث التدرّب المنتظم تقدماً حقيقياً." },
    curious: { word: "فضولي", sentence: "ابق فضولياً عندما تبدو كلمة جديدة صعبة." },
    explore: { word: "يستكشف", sentence: "أحب استكشاف أماكن وأفكار جديدة." },
    prepare: { word: "يستعد", sentence: "أستعد قليلاً قبل كل درس." },
  },
  es: {
    improve: { word: "mejorar", sentence: "Quiero mejorar mi inglés." },
    achieve: { word: "lograr / alcanzar", sentence: "Los pequeños pasos me ayudan a alcanzar mis objetivos." },
    effort: { word: "esfuerzo", sentence: "Cada esfuerzo hace más fácil el siguiente paso." },
    discipline: { word: "disciplina", sentence: "La disciplina mantiene constante mi práctica." },
    consistent: { word: "constante", sentence: "La práctica constante crea un progreso real." },
    curious: { word: "curioso", sentence: "Mantente curioso cuando una palabra nueva parezca difícil." },
    explore: { word: "explorar", sentence: "Me encanta explorar lugares e ideas nuevas." },
    prepare: { word: "preparar", sentence: "Me preparo un poco antes de cada lección." },
  },
};

function sentenceForLanguage(text: string, targetLanguage: string) {
  const clean = text.trim().toLowerCase();
  const templates: Record<string, string> = {
    en: `I am learning how to use ${clean} naturally.`,
    es: `Estoy aprendiendo a usar ${clean} de forma natural.`,
    fr: `J’apprends à utiliser ${clean} naturellement.`,
    de: `Ich lerne, ${clean} natürlich zu verwenden.`,
    pt: `Estou aprendendo a usar ${clean} naturalmente.`,
    it: `Sto imparando a usare ${clean} in modo naturale.`,
    tr: `${clean} kelimesini doğal şekilde kullanmayı öğreniyorum.`,
    ja: `${clean}を自然に使えるように学んでいます。`,
    ko: `${clean}을 자연스럽게 사용하는 법을 배우고 있어요.`,
    zh: `我正在学习自然地使用${clean}。`,
    ru: `Я учусь естественно использовать слово ${clean}.`,
  };
  return templates[targetLanguage] ?? templates.en;
}

function wordDetails(text: string, nativeLanguage = "en", targetLanguage = "en") {
  const clean = text.trim().toLowerCase();
  const knownExample = examples[clean];
  const example = targetLanguage === "en" && knownExample ? knownExample : {
    meaning: "",
    pronunciation: `/${clean}/`,
    sentence: sentenceForLanguage(clean, targetLanguage),
  };
  const localized = targetLanguage === "en" ? translations[nativeLanguage]?.[clean] : undefined;
  return {
    ...example,
    translation: localized?.word ?? "",
    sentenceTranslation: localized?.sentence ?? "",
  };
}

function statusForMastery(mastery: number) {
  if (mastery >= 90) return "Mastered";
  if (mastery >= 72) return "Strong";
  if (mastery >= 48) return "Familiar";
  if (mastery > 0) return "Learning";
  return "New";
}

async function ensureProfile() {
  if (demoReady) return;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID));
  if (!profile) {
    await db.insert(profilesTable).values({ userId: DEMO_USER_ID });
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
  const dueCount = words.filter((word) => word.nextReview != null && word.nextReview <= new Date()).length;
  return {
    id: set.id,
    name: set.name,
    wordCount: words.length,
    mastery,
    dueCount,
    lastPracticed: set.lastPracticed,
    nativeLanguage: set.nativeLanguage,
    targetLanguage: set.targetLanguage,
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

function currentStreakFor(attempts: Array<{ activityDate: string | null; createdAt: Date }>, activityDate: string) {
  const activityDates = new Set(attempts.map((attempt) => attempt.activityDate ?? attempt.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  let cursor = new Date(`${activityDate}T00:00:00.000Z`);
  while (activityDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

router.get("/dashboard", async (req, res): Promise<void> => {
  await ensureProfile();
  const summaries = await getSetSummaries();
  const dueWords = await db.select().from(wordsTable).where(lte(wordsTable.nextReview, new Date()));
  const profile = (await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID)))[0];
  const attempts = await db.select().from(practiceAttemptsTable);
  const activityDate = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
  const minutesLearned = Math.round(
    attempts.filter((attempt) => (attempt.activityDate ?? attempt.createdAt.toISOString().slice(0, 10)) === activityDate)
      .reduce((total, attempt) => total + attempt.durationSeconds, 0) / 60,
  );
  const streak = currentStreakFor(attempts, activityDate);
  const reviewItems = dueWords.length;
  const continueSet = summaries.find((set) => set.lastPracticed != null) ?? null;
  res.json(GetDashboardResponse.parse({
    greeting: "",
    minutesLearned,
    dailyGoal: profile?.dailyGoal ?? 15,
    streak,
    reviewItems,
    continueSet,
  }));
});

router.get("/profile", async (req, res): Promise<void> => {
  await ensureProfile();
  const profile = (await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID)))[0];
  const attempts = await db.select().from(practiceAttemptsTable);
  const activityDate = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
  res.json(GetProfileResponse.parse({
    userName: profile?.userName ?? "Learner",
    nativeLanguage: profile?.nativeLanguage ?? "",
    targetLanguage: profile?.targetLanguage ?? "",
    dailyGoal: profile?.dailyGoal ?? 15,
    onboardingComplete: profile?.onboardingComplete ?? false,
    currentStreak: currentStreakFor(attempts, activityDate),
    hasPracticeHistory: attempts.length > 0,
  }));
});

router.get("/word-sets", async (_req, res): Promise<void> => {
  await ensureProfile();
  res.json(ListWordSetsResponse.parse(await getSetSummaries()));
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureProfile();
  const current = (await db.select().from(profilesTable).where(eq(profilesTable.userId, DEMO_USER_ID)))[0];
  const nextNative = parsed.data.nativeLanguage ?? current?.nativeLanguage ?? "";
  const nextTarget = parsed.data.targetLanguage ?? current?.targetLanguage ?? "";
  if (nextNative && nextTarget && nextNative === nextTarget) {
    res.status(400).json({ error: "Choose two different languages." });
    return;
  }
  const [profile] = await db.update(profilesTable).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(profilesTable.userId, DEMO_USER_ID)).returning();
  const attempts = await db.select().from(practiceAttemptsTable);
  const activityDate = new Date().toISOString().slice(0, 10);
  res.json(GetProfileResponse.parse({
    userName: profile?.userName ?? "Learner",
    nativeLanguage: profile?.nativeLanguage ?? "",
    targetLanguage: profile?.targetLanguage ?? "",
    dailyGoal: profile?.dailyGoal ?? 15,
    onboardingComplete: profile?.onboardingComplete ?? false,
    currentStreak: currentStreakFor(attempts, activityDate),
    hasPracticeHistory: attempts.length > 0,
  }));
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
      nativeLanguage: parsed.data.nativeLanguage,
      targetLanguage: parsed.data.targetLanguage,
    }).returning();
    if (!set) throw new Error("Unable to create word set");
    await tx.insert(wordsTable).values(words.map((text) => {
      const details = wordDetails(text, parsed.data.nativeLanguage, parsed.data.targetLanguage);
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
  await ensureProfile();
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
  await ensureProfile();
  const dueWords = await db.select().from(wordsTable).where(lte(wordsTable.nextReview, new Date()));
  const attempts = await db.select().from(practiceAttemptsTable);
  res.json(GetReviewResponse.parse({
    total: dueWords.length,
    hasPracticeHistory: attempts.length > 0,
    dueSetId: dueWords[0]?.setId ?? null,
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
    durationSeconds: parsed.data.durationSeconds ?? 0,
    activityDate: parsed.data.activityDate ?? new Date().toISOString().slice(0, 10),
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