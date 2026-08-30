import { Router, type IRouter } from "express";
import { and, desc, eq, lte } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
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

const supportedPartsOfSpeech = [
  "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition",
  "Conjunction", "Article / Determiner", "Expression", "Other",
] as const;
type PartOfSpeech = (typeof supportedPartsOfSpeech)[number];

type ProcessedWord = {
  word: string;
  translation: string;
  partOfSpeech: PartOfSpeech;
  alternativePartsOfSpeech: string[];
  pronunciation: string;
  exampleSentence: string;
  exampleTranslation: string;
  meaning: string;
};

const retryableStatusCodes = new Set([408, 409, 429, 500, 502, 503, 504]);

function isProcessedWord(value: unknown): value is ProcessedWord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.word === "string" &&
    typeof item.translation === "string" &&
    typeof item.partOfSpeech === "string" &&
    supportedPartsOfSpeech.includes(item.partOfSpeech as PartOfSpeech) &&
    Array.isArray(item.alternativePartsOfSpeech) &&
    item.alternativePartsOfSpeech.every((part) => typeof part === "string") &&
    typeof item.pronunciation === "string" &&
    typeof item.exampleSentence === "string" &&
    typeof item.exampleTranslation === "string" &&
    typeof item.meaning === "string";
}

async function processWordsWithGemini(words: string[], nativeLanguage: string, targetLanguage: string): Promise<ProcessedWord[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a careful language-learning lexicographer.
Process every input word and return only valid JSON in this exact shape:
{"words":[{"word":"...","translation":"...","meaning":"...","partOfSpeech":"Verb","alternativePartsOfSpeech":[],"pronunciation":"...","exampleSentence":"...","exampleTranslation":"..."}]}

Native language: ${nativeLanguage}
Target language: ${targetLanguage}
Input words: ${JSON.stringify(words)}

Rules:
- Return exactly one item for every input word, in the same order.
- Keep word in the target-language form provided by the user.
- Translate each word and example sentence into the native language.
- Write the example sentence in the target language.
- Use only these partOfSpeech values: ${supportedPartsOfSpeech.join(", ")}.
- Use alternativePartsOfSpeech for genuine additional grammatical uses; otherwise [].
- Do not omit, invent, or merge input words.`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
      });
      const raw = response.text?.trim();
      if (!raw) throw new Error("Gemini returned an empty response");
      const parsed: unknown = JSON.parse(raw);
      const items = parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
        ? (parsed as { words: unknown[] }).words
        : null;
      if (!items || items.length !== words.length || !items.every(isProcessedWord)) {
        throw new Error("Gemini returned invalid word data");
      }
      return items.map((item, index) => ({ ...item, word: words[index] }));
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      if (attempt === 2 || (status != null && !retryableStatusCodes.has(status))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini processing failed");
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
  const words = parsed.data.words.map((word) => word.trim()).filter(Boolean);
  if (words.length < 4) {
    res.status(400).json({ error: "Add at least four words." });
    return;
  }
  let processedWords: ProcessedWord[];
  try {
    processedWords = await processWordsWithGemini(
      words,
      parsed.data.nativeLanguage,
      parsed.data.targetLanguage,
    );
  } catch (error) {
    console.error("Gemini word processing failed", error);
    res.status(502).json({ error: "AI processing failed. Nothing was saved; please retry." });
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
    await tx.insert(wordsTable).values(processedWords.map((item) => ({
      setId: set.id,
      text: item.word.trim(),
      meaning: item.meaning,
      translation: item.translation,
      partOfSpeech: item.partOfSpeech,
      alternativePartsOfSpeech: item.alternativePartsOfSpeech,
      pronunciation: item.pronunciation,
      sentence: item.exampleSentence,
      sentenceTranslation: item.exampleTranslation,
    })));
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