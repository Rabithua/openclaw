export type PersonaConfig = {
  name?: string;
  description?: string;
  voice?: string;
  boundaries?: string[];
};

export type InterestsConfig = {
  include?: string[];
  exclude?: string[];
};

export type SourceConfig = {
  type: "rss";
  name?: string;
  url: string;
  limit?: number; // per-source batch limit
};

export type RankingConfig = {
  daily_limit?: number;
  min_score?: number;
  dedupe_window_days?: number;
  max_notes_per_run?: number;
};

export type OutputRoteConfig = {
  enabled?: boolean;
  tags?: string[];
  add_daily_digest?: boolean;
};

export type PromptConfig = {
  max_title_length?: number;
  tags?: string[];
  public?: boolean;
  language?: string;
};

export type TravelerConfig = {
  persona?: PersonaConfig;
  prompt?: PromptConfig;
  interests?: InterestsConfig;
  sources?: SourceConfig[];
  ranking?: RankingConfig;
  output?: {
    rote?: OutputRoteConfig;
  };
};

export type FeedItem = {
  source: string;
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

export type SelectedItem = FeedItem & {
  score: number;
  reasons: string[];
};
