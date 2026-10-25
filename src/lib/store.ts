"use client";

import { useSyncExternalStore } from "react";
import type { PartId, Question } from "@/content/schema";
import type { Response } from "./grading";
import { applyReview, logMiss, type ErrorEntry, type ErrorType } from "./srs";
import { localStorageAdapter, type StorageAdapter } from "./storage";

export const STORAGE_KEY = "tuprep:v2";
const MAX_ATTEMPTS = 20000;

// ------------------------------------------------------------------ types

export type AttemptMode = "practice" | "challenge" | "review" | "diagnostic" | "test" | "mock";

export interface Attempt {
  qid: string;
  unit: string;
  part: PartId;
  tags: string[];
  difficulty: 1 | 2 | 3;
  correct: boolean;
  at: number;
  ms: number;
  mode: AttemptMode;
  hint?: boolean;
}

export interface RunItem {
  qid: string;
  response: Response;
  ms: number;
  flagged: boolean;
  visited: boolean;
}

export interface RunSection {
  part: PartId;
  title: string;
  minutes: number;
  items: RunItem[];
  startedAt: number | null;
  deadline: number | null;
  finishedAt: number | null;
}

export interface ActiveRun {
  id: string;
  kind: "unit-test" | "mock";
  title: string;
  unit?: string;
  format?: "cst" | "tue";
  source?: string;
  noGoingBack: boolean;
  startedAt: number;
  sections: RunSection[];
  sectionIndex: number;
  current: number;
  /** When the current question was opened (for time-per-question). */
  enteredAt: number | null;
  onBreak: boolean;
}

export interface RunResult {
  id: string;
  kind: ActiveRun["kind"];
  title: string;
  unit?: string;
  format?: "cst" | "tue";
  source?: string;
  noGoingBack: boolean;
  startedAt: number;
  finishedAt: number;
  sections: (RunSection & { correct: number; total: number })[];
  score: number;
}

export interface AskEntry {
  id: string;
  unit: string;
  text: string;
  status: "open" | "answered";
  note: string;
  link: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  at: number;
}

export interface StudyLogEntry {
  id: string;
  date: string;
  minutes: number;
  note: string;
}

export interface KeyDateEntry {
  id: string;
  label: string;
  date: string;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  vwoAverage: number | null;
  dailyGoal: number;
}

export interface AppData {
  version: 2;
  attempts: Attempt[];
  errors: Record<string, ErrorEntry>;
  bookmarks: string[];
  runs: RunResult[];
  activeRun: ActiveRun | null;
  ask: AskEntry[];
  chats: Record<string, ChatMsg[]>;
  tasksDone: Record<string, string>;
  taskOverrides: Record<string, string>;
  resourcesDone: Record<string, boolean>;
  studyLog: StudyLogEntry[];
  keyDates: KeyDateEntry[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { theme: "system", vwoAverage: null, dailyGoal: 20 };

export const EMPTY: AppData = {
  version: 2,
  attempts: [],
  errors: {},
  bookmarks: [],
  runs: [],
  activeRun: null,
  ask: [],
  chats: {},
  tasksDone: {},
  taskOverrides: {},
  resourcesDone: {},
  studyLog: [],
  keyDates: [],
  settings: DEFAULT_SETTINGS,
};

/** Validate/repair data from storage or an import file. */
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") throw new Error("Not a TUPrep progress file");
  const r = raw as Partial<AppData>;
  if (r.version !== 2) throw new Error(`Unsupported data version ${String((raw as { version?: unknown }).version)}`);
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const obj = <T,>(x: unknown): T => (x && typeof x === "object" && !Array.isArray(x) ? (x as T) : ({} as T));
  return {
    version: 2,
    attempts: arr<Attempt>(r.attempts).filter((a) => a && typeof a.qid === "string"),
    errors: obj<Record<string, ErrorEntry>>(r.errors),
    bookmarks: arr<string>(r.bookmarks).filter((x) => typeof x === "string"),
    runs: arr<RunResult>(r.runs).filter((x) => x && typeof x.id === "string"),
    activeRun: r.activeRun ?? null,
    ask: arr<AskEntry>(r.ask),
    chats: obj<Record<string, ChatMsg[]>>(r.chats),
    tasksDone: obj<Record<string, string>>(r.tasksDone),
    taskOverrides: obj<Record<string, string>>(r.taskOverrides),
    resourcesDone: obj<Record<string, boolean>>(r.resourcesDone),
    studyLog: arr<StudyLogEntry>(r.studyLog),
    keyDates: arr<KeyDateEntry>(r.keyDates),
    settings: { ...DEFAULT_SETTINGS, ...obj<Partial<Settings>>(r.settings) },
  };
}

// --------------------------------------------------------- store engine

let adapter: StorageAdapter = localStorageAdapter(STORAGE_KEY);
let state: AppData = EMPTY;
let hydrated = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Swap the persistence layer (e.g. a database adapter later, or memory in tests). */
export function configureStorage(a: StorageAdapter) {
  adapter = a;
  hydrated = false;
  loading = null;
  state = EMPTY;
}

function ensureLoaded() {
  if (hydrated || loading || typeof window === "undefined") return;
  loading = adapter
    .load()
    .then((raw) => {
      if (raw) {
        try {
          state = normalize(raw);
        } catch {
          state = EMPTY;
        }
      }
    })
    .catch(() => {
      state = EMPTY;
    })
    .finally(() => {
      hydrated = true;
      emit();
    });
  adapter.subscribe?.((raw) => {
    try {
      state = raw ? normalize(raw) : EMPTY;
      emit();
    } catch {
      /* ignore */
    }
  });
}

export function getState(): AppData {
  ensureLoaded();
  return state;
}

export function setState(update: (s: AppData) => AppData) {
  ensureLoaded();
  state = update(state);
  void adapter.save(state).catch(() => {
    /* storage full or blocked: keep working in memory */
  });
  emit();
}

function subscribe(l: () => void) {
  ensureLoaded();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Whole app state; EMPTY during SSR and until storage has loaded. */
export function useAppState(): AppData {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

/** True once persisted data has been loaded (client only). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ----------------------------------------------------------------- actions

export interface AnswerInput {
  q: Question;
  correct: boolean;
  ms: number;
  mode: AttemptMode;
  hint?: boolean;
}

/** Record answers; misses enter the error log automatically, review answers move the spaced-review queue. */
export function recordAnswers(list: AnswerInput[], now = Date.now()) {
  if (!list.length) return;
  setState((s) => {
    const errors = { ...s.errors };
    const added: Attempt[] = list.map(({ q, correct, ms, mode, hint }) => {
      const prev = errors[q.id];
      if (mode === "review" && prev) errors[q.id] = applyReview(prev, correct, now);
      else if (!correct) errors[q.id] = logMiss(prev, q.id, q.unit, now);
      return { qid: q.id, unit: q.unit, part: unitPart(q.unit), tags: q.tags, difficulty: q.difficulty, correct, at: now, ms, mode, hint };
    });
    return { ...s, errors, attempts: [...s.attempts, ...added].slice(-MAX_ATTEMPTS) };
  });
}

function unitPart(unit: string): PartId {
  return unit.startsWith("L") ? "logic" : unit.startsWith("A") ? "algorithmic" : "math";
}

export function addToErrorLog(q: Question, now = Date.now()) {
  setState((s) => ({ ...s, errors: { ...s.errors, [q.id]: s.errors[q.id] && !s.errors[q.id].resolved ? s.errors[q.id] : logMiss(undefined, q.id, q.unit, now, "manual") } }));
}

export function updateError(qid: string, patch: Partial<Pick<ErrorEntry, "errorType" | "note" | "resolved">>) {
  setState((s) => (s.errors[qid] ? { ...s, errors: { ...s.errors, [qid]: { ...s.errors[qid], ...patch } } } : s));
}

export function setErrorType(qid: string, t: ErrorType | undefined) {
  updateError(qid, { errorType: t });
}

export function removeError(qid: string) {
  setState((s) => {
    const errors = { ...s.errors };
    delete errors[qid];
    return { ...s, errors };
  });
}

export function toggleBookmark(qid: string) {
  setState((s) => ({ ...s, bookmarks: s.bookmarks.includes(qid) ? s.bookmarks.filter((b) => b !== qid) : [...s.bookmarks, qid] }));
}

export function setActiveRun(run: ActiveRun | null) {
  setState((s) => ({ ...s, activeRun: run }));
}

export function updateActiveRun(fn: (r: ActiveRun) => ActiveRun) {
  setState((s) => (s.activeRun ? { ...s, activeRun: fn(s.activeRun) } : s));
}

export function saveRunResult(result: RunResult) {
  setState((s) => ({ ...s, runs: [...s.runs, result], activeRun: null }));
}

export function deleteRunResult(id: string) {
  setState((s) => ({ ...s, runs: s.runs.filter((r) => r.id !== id) }));
}

export function upsertAsk(entry: AskEntry) {
  setState((s) => ({ ...s, ask: s.ask.some((a) => a.id === entry.id) ? s.ask.map((a) => (a.id === entry.id ? entry : a)) : [...s.ask, entry] }));
}

export function deleteAsk(id: string) {
  setState((s) => ({ ...s, ask: s.ask.filter((a) => a.id !== id) }));
}

export function appendChat(unit: string, msg: ChatMsg) {
  setState((s) => ({ ...s, chats: { ...s.chats, [unit]: [...(s.chats[unit] ?? []), msg].slice(-60) } }));
}

export function clearChat(unit: string) {
  setState((s) => {
    const chats = { ...s.chats };
    delete chats[unit];
    return { ...s, chats };
  });
}

export function toggleTask(id: string, now = new Date()) {
  setState((s) => {
    const tasksDone = { ...s.tasksDone };
    if (tasksDone[id]) delete tasksDone[id];
    else tasksDone[id] = now.toISOString();
    return { ...s, tasksDone };
  });
}

export function setTaskOverrides(overrides: Record<string, string>) {
  setState((s) => ({ ...s, taskOverrides: overrides }));
}

export function toggleResource(id: string) {
  setState((s) => ({ ...s, resourcesDone: { ...s.resourcesDone, [id]: !s.resourcesDone[id] } }));
}

export function addStudyLog(e: Omit<StudyLogEntry, "id">) {
  setState((s) => ({ ...s, studyLog: [...s.studyLog, { ...e, id: uid() }] }));
}

export function removeStudyLog(id: string) {
  setState((s) => ({ ...s, studyLog: s.studyLog.filter((x) => x.id !== id) }));
}

export function addKeyDate(e: Omit<KeyDateEntry, "id">) {
  setState((s) => ({ ...s, keyDates: [...s.keyDates, { ...e, id: uid() }] }));
}

export function removeKeyDate(id: string) {
  setState((s) => ({ ...s, keyDates: s.keyDates.filter((x) => x.id !== id) }));
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function exportJson(): string {
  return JSON.stringify({ ...getState(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text: string) {
  const next = normalize(JSON.parse(text));
  setState(() => next);
}

export function resetAll() {
  setState(() => EMPTY);
  void adapter.clear();
}
