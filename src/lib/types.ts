/** A search shortcut and its destination. */
export interface Bang {
  ad?: string;
  d: string;
  s: string;
  u: string;
}

/** Search shortcuts keyed by their trigger. */
export type BangMap = Record<string, Bang>;

/** A search recorded in local history. */
export interface SearchHistoryEntry {
  bang: string;
  name: string;
  query: string;
  timestamp: number;
}
