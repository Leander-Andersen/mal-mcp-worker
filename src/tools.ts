import { MalClient, MalAnime, MalListResponse, ListStatus } from "./mal.js";

export interface McpToolProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: McpTool[] = [
  {
    name: "mal_search_anime",
    description:
      "Search MyAnimeList for anime by title keyword. Returns a list with id, title, synopsis, score, episodes, status, and cover image.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (anime title or keyword)",
        },
        limit: {
          type: "integer",
          description: "Number of results to return (1–100, default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "mal_get_anime",
    description:
      "Get full details (including synopsis) for one or more anime by MAL ID. Use 'id' for a single anime or 'ids' for a batch of up to 25. Requests are parallelised automatically. Use this to enrich results from mal_get_user_list or mal_search_anime when synopsis or full details are needed.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "Single MyAnimeList anime ID",
        },
        ids: {
          type: "array",
          description:
            "Array of MyAnimeList anime IDs for batch lookup (max 25)",
          items: { type: "integer" },
        },
      },
    },
  },
  {
    name: "mal_get_rankings",
    description:
      "Get top-ranked anime from MyAnimeList by ranking type (all-time, airing, upcoming, by type, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        ranking_type: {
          type: "string",
          description: "Ranking category (default: all)",
          enum: [
            "all",
            "airing",
            "upcoming",
            "tv",
            "ova",
            "movie",
            "special",
            "bypopularity",
            "favorite",
          ],
        },
        limit: {
          type: "integer",
          description: "Number of results to return (1–100, default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "mal_get_seasonal",
    description:
      "Get the anime airing in a specific season and year, sorted by score.",
    inputSchema: {
      type: "object",
      properties: {
        year: {
          type: "integer",
          description: "Year (e.g. 2025)",
        },
        season: {
          type: "string",
          description:
            "Season of the year (winter=Jan-Mar, spring=Apr-Jun, summer=Jul-Sep, fall=Oct-Dec)",
          enum: ["winter", "spring", "summer", "fall"],
        },
        limit: {
          type: "integer",
          description: "Number of results to return (1–100, default 10)",
        },
      },
      required: ["year", "season"],
    },
  },
  {
    name: "mal_get_user_list",
    description:
      "Fetch a public MyAnimeList user's anime list with personal scores. Use fetch_all=true to retrieve the complete list (up to 2000 entries). Synopsis is not included in list results — use mal_get_anime with an 'ids' array to batch-fetch full details for specific entries.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "MyAnimeList username",
        },
        status: {
          type: "string",
          description: "Filter by watch status (omit for all entries)",
          enum: [
            "watching",
            "completed",
            "on_hold",
            "dropped",
            "plan_to_watch",
          ],
        },
        fetch_all: {
          type: "boolean",
          description:
            "Set to true to fetch the user's complete list (paginates automatically). Default false returns up to 100 entries.",
        },
        limit: {
          type: "integer",
          description:
            "Number of entries to return when fetch_all is false (1–100, default 100). Ignored when fetch_all is true.",
        },
      },
      required: ["username"],
    },
  },
];

function formatAnimeList(res: MalListResponse): string {
  if (res.data.length === 0) {
    return "No results found.";
  }
  return res.data
    .map((item, i) => {
      const a = item.node;
      const ls: ListStatus | undefined = item.list_status;
      const cover = a.main_picture?.medium ?? "N/A";
      const scoreStr = ls
        ? `Your score: ${ls.score ?? "–"} | Global score: ${a.mean ?? "N/A"}`
        : `Score: ${a.mean ?? "N/A"}`;
      const watchStr = ls
        ? ` | Watch status: ${ls.status ?? "?"} | Watched: ${ls.num_episodes_watched ?? 0}/${a.num_episodes ?? "?"} eps`
        : ` | Episodes: ${a.num_episodes ?? "?"} | Status: ${a.status ?? "?"}`;
      return [
        `${i + 1}. ${a.title} (ID: ${a.id})`,
        `   ${scoreStr}${watchStr} | Type: ${a.media_type ?? "?"}`,
        `   Cover: ${cover}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function formatAnimeDetail(a: MalAnime): string {
  const lines: string[] = [];
  lines.push(`Title: ${a.title}`);
  if (a.alternative_titles?.en) lines.push(`English: ${a.alternative_titles.en}`);
  if (a.alternative_titles?.ja) lines.push(`Japanese: ${a.alternative_titles.ja}`);
  lines.push(`ID: ${a.id}`);
  lines.push(`Type: ${a.media_type ?? "?"}`);
  lines.push(`Status: ${a.status ?? "?"}`);
  lines.push(`Episodes: ${a.num_episodes ?? "?"}`);
  lines.push(`Score: ${a.mean ?? "N/A"}`);
  lines.push(`Rank: ${a.rank ?? "N/A"}`);
  lines.push(`Popularity: ${a.popularity ?? "N/A"}`);
  if (a.genres?.length) {
    lines.push(`Genres: ${a.genres.map((g) => g.name).join(", ")}`);
  }
  if (a.studios?.length) {
    lines.push(`Studios: ${a.studios.map((s) => s.name).join(", ")}`);
  }
  if (a.source) lines.push(`Source: ${a.source}`);
  if (a.rating) lines.push(`Rating: ${a.rating}`);
  if (a.broadcast?.day_of_week) {
    lines.push(
      `Broadcast: ${a.broadcast.day_of_week}${a.broadcast.start_time ? ` at ${a.broadcast.start_time}` : ""}`
    );
  }
  if (a.main_picture?.large) lines.push(`Cover: ${a.main_picture.large}`);
  if (a.synopsis) {
    lines.push(`\nSynopsis:\n${a.synopsis}`);
  }
  return lines.join("\n");
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  mal: MalClient
): Promise<string> {
  switch (name) {
    case "mal_search_anime": {
      const query = args.query as string;
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const res = await mal.searchAnime(query, limit);
      return formatAnimeList(res);
    }

    case "mal_get_anime": {
      if (Array.isArray(args.ids)) {
        const ids = (args.ids as number[]).slice(0, 25);
        const anime = await mal.getAnimeBatch(ids);
        return anime.map(formatAnimeDetail).join("\n\n---\n\n");
      }
      const anime = await mal.getAnime(args.id as number);
      return formatAnimeDetail(anime);
    }

    case "mal_get_rankings": {
      const rankingType =
        typeof args.ranking_type === "string" ? args.ranking_type : "all";
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const res = await mal.getRankings(rankingType, limit);
      return formatAnimeList(res);
    }

    case "mal_get_seasonal": {
      const year = args.year as number;
      const season = args.season as string;
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const res = await mal.getSeasonal(year, season, limit);
      return formatAnimeList(res);
    }

    case "mal_get_user_list": {
      const username = args.username as string;
      const status = typeof args.status === "string" ? args.status : undefined;
      const fetchAll = args.fetch_all === true;
      const limit = typeof args.limit === "number" ? args.limit : 100;
      const res = await mal.getUserList(username, status, limit, fetchAll);
      const totalNote = fetchAll
        ? `\nTotal entries fetched: ${res.data.length}\n`
        : "";
      return totalNote + formatAnimeList(res);
    }

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}
