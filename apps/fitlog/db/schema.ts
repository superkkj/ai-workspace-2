import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  nickname: text("nickname").notNull(),
});

export const shoes = sqliteTable("shoes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  requestFingerprint: text("request_fingerprint"),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  size: integer("size").notNull(),
  width: text("width").notNull(),
  fit: text("fit").notNull(),
  purpose: text("purpose").notNull(),
  memo: text("memo").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("shoes_user_request").on(t.userId, t.requestId),
  index("shoes_user_created").on(t.userId, t.createdAt),
  check("shoes_size", sql`${t.size} BETWEEN 180 AND 350 AND ${t.size} % 5 = 0`),
]);

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  requestFingerprint: text("request_fingerprint"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  purpose: text("purpose").notNull(),
  width: text("width").notNull(),
  targetModel: text("target_model").notNull().default(""),
  referenceJson: text("reference_json"),
  nickname: text("nickname").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("questions_user_request").on(t.userId, t.requestId),
  index("questions_visible_created").on(t.hidden, t.createdAt),
  index("questions_user_created").on(t.userId, t.createdAt),
]);

export const answers = sqliteTable("answers", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  requestFingerprint: text("request_fingerprint"),
  body: text("body").notNull(),
  referenceJson: text("reference_json"),
  nickname: text("nickname").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("answers_user_request").on(t.userId, t.requestId),
  index("answers_question_created").on(t.questionId, t.createdAt),
]);

export const choices = sqliteTable("choices", {
  questionId: text("question_id").primaryKey().references(() => questions.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [check("choices_size", sql`${t.size} BETWEEN 180 AND 350 AND ${t.size} % 5 = 0`)]);

export const reviews = sqliteTable("reviews", {
  questionId: text("question_id").primaryKey().references(() => questions.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  fit: text("fit").notNull(),
  distanceKm: real("distance_km"),
  firstUsedAt: text("first_used_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  targetType: text("target_type").notNull(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answerId: text("answer_id").references(() => answers.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("reports_user_request").on(t.userId, t.requestId),
  index("reports_status_created").on(t.status, t.createdAt),
  check("reports_target", sql`(${t.targetType} = 'question' AND ${t.answerId} IS NULL) OR (${t.targetType} = 'answer' AND ${t.answerId} IS NOT NULL)`),
]);
