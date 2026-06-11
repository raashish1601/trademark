/** A snapshot of a journal trade, shared by explicit user action. Never a live link. */
export interface TradeCard {
  symbol: string;
  segment: "EQ" | "FUT" | "OPT";
  strike?: number | null;
  optionType?: "CE" | "PE" | null;
  expiry?: string | null;
  direction: "long" | "short";
  entry: number;
  exit?: number | null;
  sl?: number | null;
  target?: number | null;
  rMultiple?: number | null;
  /** Only present when the author opted in to sharing ₹ P&L. */
  netPnl?: number | null;
  holdMins?: number | null;
  openedAt: string;
}

export interface AuthorView {
  username: string;
  displayName: string;
}

export interface PostView {
  id: string;
  title: string | null;
  body: string;
  tags: string[];
  tradeCard: TradeCard | null;
  images: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  likedByMe: boolean;
  mine: boolean;
  author: AuthorView;
}

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  author: AuthorView;
}

export interface ProfileView {
  username: string;
  displayName: string;
  bio: string | null;
  createdAt: string;
  postCount: number;
}

export interface FeedResponse {
  posts: PostView[];
  nextCursor: string | null;
}

export const SUGGESTED_TAGS = [
  "nifty",
  "banknifty",
  "options",
  "futures",
  "psychology",
  "setups",
  "question",
  "review",
] as const;
