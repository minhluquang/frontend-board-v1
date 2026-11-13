const CURSOR_STORAGE_KEY = "helpdesk_changes_cursor";
const SEQS_STORAGE_KEY = "helpdesk_changes_processed_seqs";
const MAX_STORED_SEQS = 5000;

export interface SyncStorage {
  getCursor(): string | null;
  setCursor(cursor: string | null): void;
  clearCursor(): void;
  hasSeq(seq: number): boolean;
  addSeqs(seqs: number[]): void;
  getProcessedSeqs(): number[];
  clearAll(): void;
}

export class ChangesSyncStorage implements SyncStorage {
  private memoryCursor: string | null = null;
  private memorySeqs: Set<number> = new Set();
  private storageAvailable: boolean;

  constructor() {
    this.storageAvailable = this.checkStorage();
    this.loadInitialState();
  }

  private checkStorage(): boolean {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return false;
      const testKey = "__helpdesk_storage_probe__";
      window.sessionStorage.setItem(testKey, "1");
      window.sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private loadInitialState(): void {
    if (!this.storageAvailable) return;
    try {
      const storedCursor = window.sessionStorage.getItem(CURSOR_STORAGE_KEY);
      if (storedCursor) {
        this.memoryCursor = storedCursor;
      }
      const storedSeqs = window.sessionStorage.getItem(SEQS_STORAGE_KEY);
      if (storedSeqs) {
        const parsed = JSON.parse(storedSeqs);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            if (typeof s === "number" && Number.isSafeInteger(s)) {
              this.memorySeqs.add(s);
            }
          }
          this.trimSeqs();
        }
      }
    } catch {
      // In case of parsing or permission errors, keep memory state
    }
  }

  getCursor(): string | null {
    if (this.storageAvailable) {
      try {
        const val = window.sessionStorage.getItem(CURSOR_STORAGE_KEY);
        return val ?? this.memoryCursor;
      } catch {
        return this.memoryCursor;
      }
    }
    return this.memoryCursor;
  }

  setCursor(cursor: string | null): void {
    this.memoryCursor = cursor;
    if (this.storageAvailable) {
      try {
        if (cursor === null) {
          window.sessionStorage.removeItem(CURSOR_STORAGE_KEY);
        } else {
          window.sessionStorage.setItem(CURSOR_STORAGE_KEY, cursor);
        }
      } catch {
        // Fallback to memory on failure (quota exceeded, etc.)
      }
    }
  }

  clearCursor(): void {
    this.setCursor(null);
  }

  hasSeq(seq: number): boolean {
    return this.memorySeqs.has(seq);
  }

  addSeqs(seqs: number[]): void {
    for (const seq of seqs) {
      if (Number.isSafeInteger(seq)) this.memorySeqs.add(seq);
    }
    this.trimSeqs();
    if (this.storageAvailable) {
      try {
        window.sessionStorage.setItem(
          SEQS_STORAGE_KEY,
          JSON.stringify(Array.from(this.memorySeqs)),
        );
      } catch {
        // Fallback to memory on failure
      }
    }
  }

  getProcessedSeqs(): number[] {
    return Array.from(this.memorySeqs);
  }

  private trimSeqs(): void {
    while (this.memorySeqs.size > MAX_STORED_SEQS) {
      const oldestSeq = this.memorySeqs.values().next();
      if (oldestSeq.done) return;
      this.memorySeqs.delete(oldestSeq.value);
    }
  }

  clearAll(): void {
    this.memoryCursor = null;
    this.memorySeqs.clear();
    if (this.storageAvailable) {
      try {
        window.sessionStorage.removeItem(CURSOR_STORAGE_KEY);
        window.sessionStorage.removeItem(SEQS_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }
}

export const syncStorage = new ChangesSyncStorage();
