import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
export type Document = Record<string, any>;
export interface Unit {
  get<T = Document>(collection: string, id: string): Promise<T | null>;
  put(collection: string, id: string, value: Document): void;
  remove(collection: string, id: string): void;
}
export interface Store {
  get<T = Document>(collection: string, id: string): Promise<T | null>;
  list<T = Document>(
    collection: string,
    filter?: { field: string; value: unknown },
    limit?: number,
  ): Promise<T[]>;
  atomic<T>(fn: (tx: Unit) => Promise<T>): Promise<T>;
}
export function firebaseApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId)
    throw new Error("FIREBASE_PROJECT_ID is not configured on the server");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId)
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON project_id must match FIREBASE_PROJECT_ID",
      );
  }
  const existing = getApps().find((app) => app.options.projectId === projectId);
  if (existing) return existing;
  return initializeApp(
    raw
      ? { credential: cert(JSON.parse(raw)), projectId }
      : {
          projectId,
          ...(process.env.FIRESTORE_EMULATOR_HOST
            ? {}
            : { credential: applicationDefault() }),
        },
    `califnco-${projectId}`,
  );
}
export class FirestoreStore implements Store {
  db = getFirestore(firebaseApp());
  async get<T = Document>(c: string, id: string): Promise<T | null> {
    const s = await this.db.collection(c).doc(id).get();
    return s.exists ? (s.data() as T) : null;
  }
  async list<T = Document>(
    c: string,
    f?: { field: string; value: unknown },
    limit = 500,
  ): Promise<T[]> {
    let q: any = this.db.collection(c);
    if (f) q = q.where(f.field, "==", f.value);
    const s = await q.limit(limit).get();
    return s.docs.map((d: any) => d.data() as T);
  }
  async atomic<T>(fn: (tx: Unit) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (transaction) => {
      const pending = new Map<string, Document | null>();
      const tx: Unit = {
        get: async <T = Document>(c: string, id: string) => {
          const k = `${c}/${id}`;
          if (pending.has(k)) return pending.get(k) as T | null;
          const s = await transaction.get(this.db.doc(k));
          return s.exists ? (s.data() as T) : null;
        },
        put: (c, id, v) => {
          pending.set(`${c}/${id}`, v);
        },
        remove: (c, id) => {
          pending.set(`${c}/${id}`, null);
        },
      };
      const result = await fn(tx);
      for (const [k, v] of pending) {
        if (v === null) transaction.delete(this.db.doc(k));
        else transaction.set(this.db.doc(k), v);
      }
      return result;
    });
  }
}
export class MemoryStore implements Store {
  data: Record<string, Record<string, Document>> = {};
  private tail: Promise<unknown> = Promise.resolve();
  constructor(public file?: string) {}
  async load() {
    if (this.file)
      try {
        this.data = JSON.parse(await readFile(this.file, "utf8"));
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
    return this;
  }
  async get<T = Document>(c: string, id: string): Promise<T | null> {
    return structuredClone(this.data[c]?.[id] ?? null) as T | null;
  }
  async list<T = Document>(
    c: string,
    f?: { field: string; value: unknown },
    limit = 500,
  ): Promise<T[]> {
    return structuredClone(
      Object.values(this.data[c] ?? {})
        .filter((v) => !f || v[f.field] === f.value)
        .slice(0, limit),
    ) as T[];
  }
  async atomic<T>(fn: (tx: Unit) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const draft = structuredClone(this.data);
      const tx: Unit = {
        get: async <T = Document>(c: string, id: string) =>
          structuredClone(draft[c]?.[id] ?? null) as T | null,
        put: (c, id, v) => {
          draft[c] ??= {};
          draft[c][id] = structuredClone(v);
        },
        remove: (c, id) => {
          delete draft[c]?.[id];
        },
      };
      const value = await fn(tx);
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + ".tmp", JSON.stringify(draft));
        await rename(this.file + ".tmp", this.file);
      }
      this.data = draft;
      return value;
    });
    this.tail = run.catch(() => {});
    return run;
  }
}
