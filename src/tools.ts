import { MalClient, MalAnime, MalListResponse } from "./mal.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
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
      "Get full details for a specific anime by its MyAnimeList ID. Returns title, synopsis, score, rank, popularity, genres, studios, episodes, broadcast info, and more.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "MyAnimeList anime ID",
        },
      },
      required: ["id"],
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
      "Fetch a public MyAnimeList user's anime list, optionally filtered by watch status.",
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
        limit: {
          type: "integer",
          description: "Number of results to return (1–100, default 25)",
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
      const cover = a.main_picture?.medium ?? "N/A";
      return [
        `${i + 1}. ${a.title} (ID: ${a.id})`,
        `   Score: ${a.mean ?? "N/A"} | Episodes: ${a.num_episodes ?? "?"} | Status: ${a.status ?? "?"} | Type: ${a.media_type ?? "?"}`,
        `   Cover: ${cover}`,
        a.synopsis
          ? `   Synopsis: ${a.synopsis.slice(0, 200)}${a.synopsis.length > 200 ? "…" : ""}`
          : "",
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
      const id = args.id as number;
      const anime = await mal.getAnime(id);
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
      const status =
        typeof args.status === "string" ? args.status : undefined;
      const limit = typeof args.limit === "number" ? args.limit : 25;
      const res = await mal.getUserList(username, status, limit);
      return formatAnimeList(res);
    }

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}
