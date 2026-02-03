export type PersonaConfig = {
  name?: string;
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
};

export type RankingConfig = {
  daily_limit?: number;
  min_score?: number;
  dedupe_window_days?: number;
};

export type OutputRoteConfig = {
  enabled?: boolean;
  tags?: string[];
  add_daily_digest?: boolean;
};

export type TravelerConfig = {
  persona?: PersonaConfig;
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