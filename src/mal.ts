const MAL_BASE = "https://api.myanimelist.net/v2";

const LIST_FIELDS =
  "id,title,synopsis,mean,num_episodes,status,media_type,main_picture";

// Leaner field set for user list — omits synopsis to keep page payloads
// small and avoid MAL silently truncating results on large lists.
const USER_LIST_FIELDS =
  "id,title,mean,num_episodes,status,media_type,main_picture";

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

  private async fetchUrl(url: string): Promise<unknown> {
    const response = await fetch(url, {
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
        throw new Error(`Not found (404): ${url}`);
      }
      throw new Error(
        `MAL API error ${response.status}: ${body || response.statusText}`
      );
    }

    return response.json();
  }

  private async request(
    path: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(`${MAL_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return this.fetchUrl(url.toString());
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

  // Fetches multiple anime in parallel, batched to avoid hammering the API.
  // Returns results in the same order as the input ids.
  async getAnimeBatch(ids: number[], concurrency = 5): Promise<MalAnime[]> {
    const results: MalAnime[] = [];
    for (let i = 0; i < ids.length; i += concurrency) {
      const chunk = ids.slice(i, i + concurrency);
      const batch = await Promise.all(chunk.map((id) => this.getAnime(id)));
      results.push(...batch);
    }
    return results;
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
    limit = 100,
    fetchAll = false
  ): Promise<MalListResponse> {
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      throw new Error(
        `Invalid status "${status}". Valid values: ${[...VALID_STATUSES].join(", ")}`
      );
    }

    const fields = `${USER_LIST_FIELDS},list_status{status,score,num_episodes_watched}`;
    const path = `/users/${encodeURIComponent(username)}/animelist`;

    if (!fetchAll) {
      const params: Record<string, string> = {
        limit: String(Math.min(Math.max(1, limit), 100)),
        fields,
        nsfw: "true",
      };
      if (status !== undefined) params.status = status;
      return this.request(path, params) as Promise<MalListResponse>;
    }

    // Paginate by following MAL's own paging.next URLs directly rather than
    // manually incrementing offset. MAL may use internal cursors, so trusting
    // their next-page URL is more reliable than building our own.
    const allItems: MalListResponse["data"] = [];
    const maxEntries = 2000;

    // Build the first page URL manually
    const firstUrl = new URL(`${MAL_BASE}${path}`);
    firstUrl.searchParams.set("limit", "50");
    firstUrl.searchParams.set("fields", fields);
    firstUrl.searchParams.set("nsfw", "true");
    if (status !== undefined) firstUrl.searchParams.set("status", status);

    let nextUrl: string | undefined = firstUrl.toString();

    while (nextUrl !== undefined && allItems.length < maxEntries) {
      const page = (await this.fetchUrl(nextUrl)) as MalListResponse;
      allItems.push(...page.data);
      nextUrl = page.paging?.next;
    }

    // Sort on the Worker side — avoids relying on MAL's sort behaviour across pages.
    allItems.sort((a, b) => a.node.title.localeCompare(b.node.title));

    return { data: allItems };
  }
}
