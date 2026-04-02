const MAL_BASE = "https://api.myanimelist.net/v2";

const LIST_FIELDS =
  "id,title,synopsis,mean,num_episodes,status,media_type,main_picture";

const DETAIL_FIELDS = [
  "id",
  "title",
  "alternative_titles",
  "synopsis",
  "mean",
  "rank",
  "popularity",
  "num_episodes",
  "status",
  "media_type",
  "genres",
  "studios",
  "main_picture",
  "source",
  "rating",
  "broadcast",
].join(",");

const VALID_RANKING_TYPES = new Set([
  "all",
  "airing",
  "upcoming",
  "tv",
  "ova",
  "movie",
  "special",
  "bypopularity",
  "favorite",
]);

const VALID_SEASONS = new Set(["winter", "spring", "summer", "fall"]);

const VALID_STATUSES = new Set([
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "plan_to_watch",
]);

export interface MalAnime {
  id: number;
  title: string;
  synopsis?: string;
  mean?: number;
  num_episodes?: number;
  status?: string;
  media_type?: string;
  genres?: Array<{ id: number; name: string }>;
  studios?: Array<{ id: number; name: string }>;
  main_picture?: { medium: string; large: string };
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] };
  rank?: number;
  popularity?: number;
  source?: string;
  rating?: string;
  broadcast?: { day_of_week?: string; start_time?: string };
}

export interface ListStatus {
  status?: string;
  score?: number;
  num_episodes_watched?: number;
}

export interface MalListResponse {
  data: Array<{ node: MalAnime; list_status?: ListStatus }>;
  paging?: { next?: string };
}

export class MalClient {
  constructor(private readonly clientId: string) {}

  private async request(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(`${MAL_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: { "X-MAL-Client-ID": this.clientId },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new Error(
          `MAL API authentication failed (401). Check your MAL_CLIENT_ID.`
        );
      }
      if (response.status === 404) {
        throw new Error(`Not found (404): ${path}`);
      }
      throw new Error(
        `MAL API error ${response.status}: ${body || response.statusText}`
      );
    }

    return response.json();
  }

  async searchAnime(query: string, limit = 10): Promise<MalListResponse> {
    return this.request("/anime", {
      q: query,
      limit: String(Math.min(Math.max(1, limit), 100)),
      fields: LIST_FIELDS,
    }) as Promise<MalListResponse>;
  }

  async getAnime(id: number): Promise<MalAnime> {
    return this.request(`/anime/${id}`, {
      fields: DETAIL_FIELDS,
    }) as Promise<MalAnime>;
  }

  async getRankings(rankingType = "all", limit = 10): Promise<MalListResponse> {
    if (!VALID_RANKING_TYPES.has(rankingType)) {
      throw new Error(
        `Invalid ranking_type "${rankingType}". Valid values: ${[...VALID_RANKING_TYPES].join(", ")}`
      );
    }
    return this.request("/anime/ranking", {
      ranking_type: rankingType,
      limit: String(Math.min(Math.max(1, limit), 100)),
      fields: LIST_FIELDS,
    }) as Promise<MalListResponse>;
  }

  async getSeasonal(
    year: number,
    season: string,
    limit = 10
  ): Promise<MalListResponse> {
    if (!VALID_SEASONS.has(season)) {
      throw new Error(
        `Invalid season "${season}". Valid values: ${[...VALID_SEASONS].join(", ")}`
      );
    }
    return this.request(`/anime/season/${year}/${season}`, {
      limit: String(Math.min(Math.max(1, limit), 100)),
      fields: LIST_FIELDS,
      sort: "anime_score",
    }) as Promise<MalListResponse>;
  }

  async getUserList(
    username: string,
    status?: string,
    limit = 25
  ): Promise<MalListResponse> {
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      throw new Error(
        `Invalid status "${status}". Valid values: ${[...VALID_STATUSES].join(", ")}`
      );
    }
    const params: Record<string, string> = {
      limit: String(Math.min(Math.max(1, limit), 100)),
      fields: `${LIST_FIELDS},list_status{status,score,num_episodes_watched}`,
    };
    if (status !== undefined) {
      params.status = status;
    }
    return this.request(
      `/users/${encodeURIComponent(username)}/animelist`,
      params
    ) as Promise<MalListResponse>;
  }
}
