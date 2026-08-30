import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  userName: text("user_name").notNull().default("Learner"),
  nativeLanguage: text("native_language").notNull().default(""),
  targetLanguage: text("target_language").notNull().default(""),
  dailyGoal: integer("daily_goal").notNull().default(15),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  currentStreak: integer("current_streak"),
  longestStreak: integer("longest_streak"),
  minutesLearned: integer("minutes_learned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wordSetsTable = pgTable("word_sets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("demo-user"),
  name: text("name").notNull(),
  nativeLanguage: text("native_language").notNull().default(""),
  targetLanguage: text("target_language").notNull().default(""),
  lastPracticed: timestamp("last_practiced", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wordsTable = pgTable("words", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").notNull().references(() => wordSetsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  meaning: text("meaning").notNull().default("A useful word to practice in context"),
  translation: text("translation").notNull().default(""),
  pronunciation: text("pronunciation").notNull().default("/practice/"),
  sentence: text("sentence").notNull(),
  sentenceTranslation: text("sentence_translation").notNull().default(""),
  mastery: integer("mastery").notNull().default(0),
  status: text("status").notNull().default("New"),
  writing: integer("writing").notNull().default(0),
  speaking: integer("speaking").notNull().default(0),
  recall: integer("recall").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  mistakes: integer("mistakes").notNull().default(0),
  lastReviewed: timestamp("last_reviewed", { withTimezone: true }),
  nextReview: timestamp("next_review", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sentencesTable = pgTable("sentences", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id").notNull().references(() => wordsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  variation: integer("variation").notNull().default(0),
  tense: text("tense"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenseFormsTable = pgTable("tense_forms", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id").notNull().references(() => wordsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  form: text("form").notNull(),
  mastery: integer("mastery").notNull().default(0),
});

export const learningItemsTable = pgTable("learning_items", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id").notNull().references(() => wordsTable.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  tenseFormId: integer("tense_form_id"),
  mastery: integer("mastery").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  mistakes: integer("mistakes").notNull().default(0),
  lastReviewed: timestamp("last_reviewed", { withTimezone: true }),
  nextReview: timestamp("next_review", { withTimezone: true }).notNull().defaultNow(),
  difficulty: integer("difficulty").notNull().default(1),
});

export const practiceAttemptsTable = pgTable("practice_attempts", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id").notNull().references(() => wordsTable.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  correct: boolean("correct").notNull(),
  answer: text("answer"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  activityDate: date("activity_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id").notNull().references(() => wordsTable.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWordSetSchema = createInsertSchema(wordSetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWordSchema = createInsertSchema(wordsTable).omit({ id: true, createdAt: true });
export const insertSentenceSchema = createInsertSchema(sentencesTable).omit({ id: true, createdAt: true });
export const insertTenseFormSchema = createInsertSchema(tenseFormsTable).omit({ id: true });
export const insertLearningItemSchema = createInsertSchema(learningItemsTable).omit({ id: true });
export const insertPracticeAttemptSchema = createInsertSchema(practiceAttemptsTable).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true });

export type Profile = typeof profilesTable.$inferSelect;
export type WordSet = typeof wordSetsTable.$inferSelect;
export type Word = typeof wordsTable.$inferSelect;
export type Sentence = typeof sentencesTable.$inferSelect;
export type TenseForm = typeof tenseFormsTable.$inferSelect;
export type LearningItem = typeof learningItemsTable.$inferSelect;
export type PracticeAttempt = typeof practiceAttemptsTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type InsertWordSet = z.infer<typeof insertWordSetSchema>;