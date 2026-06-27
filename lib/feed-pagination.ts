export const FEED_PAGE_SIZE = 10;

export type FeedEntry = {
  uri: string;
  rkey: string;
  did: string;
  peerId: string;
  hashes: string[];
  record: {
    movement: string;
    value: number;
    unit: string;
    tranche?: string;
    createdAt: string;
    videoHash: string;
  };
};

export type FeedPagePayload = {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  movement: string;
  items: FeedEntry[];
};

export function paginateFeed<T>(items: T[], page: number, pageSize = FEED_PAGE_SIZE): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function feedTotalPages(total: number, pageSize = FEED_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
