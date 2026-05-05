export interface Bang {
  ad?: string;
  d: string;
  s: string;
  u: string;
}

export type BangMap = Record<string, Bang>;

export interface SearchHistoryEntry {
  bang: string;
  name: string;
  query: string;
  timestamp: number;
}
