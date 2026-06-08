<<<<<<< Updated upstream
import { MalClient, MalAnime, MalListResponse, ListStatus } from "./mal.js";
=======
import {
  MalClient,
  MalAnime,
  MalListResponse,
  ListStatus,
  MalUserProfile,
  MalManga,
  MangaListResponse,
  MangaListStatus,
} from "./mal.js";
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
=======
  {
    name: "mal_update_anime_status",
    description:
      "Update your MAL list entry for an anime. Requires authentication. Set watch status, personal score (0–10), and/or episodes watched. You can update any combination of fields.",
    inputSchema: {
      type: "object",
      properties: {
        anime_id: {
          type: "integer",
          description: "MAL anime ID",
        },
        status: {
          type: "string",
          description: "Watch status",
          enum: ["watching", "completed", "on_hold", "dropped", "plan_to_watch"],
        },
        score: {
          type: "integer",
          description: "Personal score from 0 (no score) to 10",
        },
        num_watched_episodes: {
          type: "integer",
          description: "Number of episodes watched",
        },
        start_date: {
          type: "string",
          description: "Date started watching (YYYY-MM-DD)",
        },
        finish_date: {
          type: "string",
          description: "Date completed (YYYY-MM-DD)",
        },
      },
      required: ["anime_id"],
    },
  },
  {
    name: "mal_delete_anime_from_list",
    description: "Remove an anime from your MAL list entirely. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        anime_id: {
          type: "integer",
          description: "MAL anime ID to remove from your list",
        },
      },
      required: ["anime_id"],
    },
  },
  {
    name: "mal_get_my_profile",
    description:
      "Get your own MAL profile and anime statistics (items watching, completed, mean score, etc.). Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "mal_search_manga",
    description:
      "Search MyAnimeList for manga, light novels, manhwa, manhua, one-shots, etc. by title keyword. Returns a list with id, title, synopsis, score, volumes, chapters, status, media_type, and cover image. Check media_type (manga, light_novel, novel, manhwa, manhua, one_shot, doujinshi) to distinguish format.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (manga/light novel title or keyword)",
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
    name: "mal_get_manga",
    description:
      "Get full details (including synopsis, authors, serialization) for one or more manga/light novels by MAL ID. Use 'id' for a single entry or 'ids' for a batch of up to 25. Requests are parallelised automatically. Use this to enrich results from mal_get_user_manga_list or mal_search_manga when full details are needed.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "Single MyAnimeList manga ID",
        },
        ids: {
          type: "array",
          description:
            "Array of MyAnimeList manga IDs for batch lookup (max 25)",
          items: { type: "integer" },
        },
      },
    },
  },
  {
    name: "mal_get_manga_rankings",
    description:
      "Get top-ranked manga from MyAnimeList by ranking type. Use 'novels' for light novels, 'manhwa'/'manhua' for those formats, or 'all' for everything.",
    inputSchema: {
      type: "object",
      properties: {
        ranking_type: {
          type: "string",
          description: "Ranking category (default: all)",
          enum: [
            "all",
            "manga",
            "novels",
            "oneshots",
            "doujin",
            "manhwa",
            "manhua",
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
    name: "mal_get_user_manga_list",
    description:
      "Fetch a public MyAnimeList user's manga/light novel list with personal scores. Use fetch_all=true to retrieve the complete list (up to 2000 entries). Synopsis is not included in list results — use mal_get_manga with an 'ids' array to batch-fetch full details for specific entries.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "MyAnimeList username",
        },
        status: {
          type: "string",
          description: "Filter by read status (omit for all entries)",
          enum: [
            "reading",
            "completed",
            "on_hold",
            "dropped",
            "plan_to_read",
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
  {
    name: "mal_update_manga_status",
    description:
      "Update your MAL list entry for a manga or light novel. Requires authentication. Set read status, personal score (0–10), and/or volumes/chapters read. You can update any combination of fields.",
    inputSchema: {
      type: "object",
      properties: {
        manga_id: {
          type: "integer",
          description: "MAL manga ID",
        },
        status: {
          type: "string",
          description: "Read status",
          enum: ["reading", "completed", "on_hold", "dropped", "plan_to_read"],
        },
        score: {
          type: "integer",
          description: "Personal score from 0 (no score) to 10",
        },
        num_volumes_read: {
          type: "integer",
          description: "Number of volumes read",
        },
        num_chapters_read: {
          type: "integer",
          description: "Number of chapters read",
        },
        start_date: {
          type: "string",
          description: "Date started reading (YYYY-MM-DD)",
        },
        finish_date: {
          type: "string",
          description: "Date completed (YYYY-MM-DD)",
        },
      },
      required: ["manga_id"],
    },
  },
  {
    name: "mal_delete_manga_from_list",
    description: "Remove a manga or light novel from your MAL list entirely. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        manga_id: {
          type: "integer",
          description: "MAL manga ID to remove from your list",
        },
      },
      required: ["manga_id"],
    },
  },
>>>>>>> Stashed changes
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

function formatAuthors(authors?: MalManga["authors"]): string {
  if (!authors?.length) return "";
  return authors
    .map((a) => {
      const name = [a.node.last_name, a.node.first_name]
        .filter(Boolean)
        .join(", ");
      return a.role ? `${name} (${a.role})` : name;
    })
    .filter(Boolean)
    .join("; ");
}

function formatMangaList(res: MangaListResponse): string {
  if (res.data.length === 0) {
    return "No results found.";
  }
  return res.data
    .map((item, i) => {
      const m = item.node;
      const ls: MangaListStatus | undefined = item.list_status;
      const cover = m.main_picture?.medium ?? "N/A";
      const scoreStr = ls
        ? `Your score: ${ls.score ?? "–"} | Global score: ${m.mean ?? "N/A"}`
        : `Score: ${m.mean ?? "N/A"}`;
      const readStr = ls
        ? ` | Read status: ${ls.status ?? "?"} | Read: ${ls.num_chapters_read ?? 0}/${m.num_chapters ?? "?"} ch, ${ls.num_volumes_read ?? 0}/${m.num_volumes ?? "?"} vol${ls.start_date ? ` | Started: ${ls.start_date}` : ""}${ls.finish_date ? ` | Completed: ${ls.finish_date}` : ""}`
        : ` | Chapters: ${m.num_chapters ?? "?"} | Volumes: ${m.num_volumes ?? "?"} | Status: ${m.status ?? "?"}`;
      return [
        `${i + 1}. ${m.title} (ID: ${m.id})`,
        `   ${scoreStr}${readStr} | Type: ${m.media_type ?? "?"}`,
        `   Cover: ${cover}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function formatMangaDetail(m: MalManga): string {
  const lines: string[] = [];
  lines.push(`Title: ${m.title}`);
  if (m.alternative_titles?.en) lines.push(`English: ${m.alternative_titles.en}`);
  if (m.alternative_titles?.ja) lines.push(`Japanese: ${m.alternative_titles.ja}`);
  lines.push(`ID: ${m.id}`);
  lines.push(`Type: ${m.media_type ?? "?"}`);
  lines.push(`Status: ${m.status ?? "?"}`);
  lines.push(`Volumes: ${m.num_volumes ?? "?"}`);
  lines.push(`Chapters: ${m.num_chapters ?? "?"}`);
  lines.push(`Score: ${m.mean ?? "N/A"}`);
  lines.push(`Rank: ${m.rank ?? "N/A"}`);
  lines.push(`Popularity: ${m.popularity ?? "N/A"}`);
  if (m.genres?.length) {
    lines.push(`Genres: ${m.genres.map((g) => g.name).join(", ")}`);
  }
  const authors = formatAuthors(m.authors);
  if (authors) lines.push(`Authors: ${authors}`);
  if (m.serialization?.length) {
    lines.push(`Serialization: ${m.serialization.map((s) => s.node.name).join(", ")}`);
  }
  if (m.source) lines.push(`Source: ${m.source}`);
  if (m.main_picture?.large) lines.push(`Cover: ${m.main_picture.large}`);
  if (m.synopsis) {
    lines.push(`\nSynopsis:\n${m.synopsis}`);
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

<<<<<<< Updated upstream
=======
    case "mal_update_anime_status": {
      if (!isAuthenticated) {
        throw new Error("This tool requires authentication. Please connect your MAL account via OAuth.");
      }
      const animeId = args.anime_id as number;
      const updates = {
        status: typeof args.status === "string" ? args.status : undefined,
        score: typeof args.score === "number" ? args.score : undefined,
        num_watched_episodes:
          typeof args.num_watched_episodes === "number" ? args.num_watched_episodes : undefined,
        start_date: typeof args.start_date === "string" ? args.start_date : undefined,
        finish_date: typeof args.finish_date === "string" ? args.finish_date : undefined,
      };
      const result = await mal.updateAnimeListStatus(animeId, updates);
      return [
        `Updated anime ${animeId}:`,
        `  Status: ${result.status}`,
        `  Score: ${result.score}`,
        `  Episodes watched: ${result.num_episodes_watched}`,
        `  Updated at: ${result.updated_at}`,
      ].join("\n");
    }

    case "mal_delete_anime_from_list": {
      if (!isAuthenticated) {
        throw new Error("This tool requires authentication. Please connect your MAL account via OAuth.");
      }
      const animeId = args.anime_id as number;
      await mal.deleteAnimeFromList(animeId);
      return `Anime ${animeId} has been removed from your list.`;
    }

    case "mal_get_my_profile": {
      if (!isAuthenticated) {
        throw new Error("This tool requires authentication. Please connect your MAL account via OAuth.");
      }
      const profile = await mal.getMyProfile();
      return formatProfile(profile);
    }

    case "mal_search_manga": {
      const query = args.query as string;
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const res = await mal.searchManga(query, limit);
      return formatMangaList(res);
    }

    case "mal_get_manga": {
      if (Array.isArray(args.ids)) {
        const ids = (args.ids as number[]).slice(0, 25);
        const manga = await mal.getMangaBatch(ids);
        return manga.map(formatMangaDetail).join("\n\n---\n\n");
      }
      const manga = await mal.getManga(args.id as number);
      return formatMangaDetail(manga);
    }

    case "mal_get_manga_rankings": {
      const rankingType =
        typeof args.ranking_type === "string" ? args.ranking_type : "all";
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const res = await mal.getMangaRankings(rankingType, limit);
      return formatMangaList(res);
    }

    case "mal_get_user_manga_list": {
      const username = args.username as string;
      const status = typeof args.status === "string" ? args.status : undefined;
      const fetchAll = args.fetch_all === true;
      const limit = typeof args.limit === "number" ? args.limit : 100;
      const res = await mal.getUserMangaList(username, status, limit, fetchAll);
      const totalNote = fetchAll
        ? `\nTotal entries fetched: ${res.data.length}\n`
        : "";
      return totalNote + formatMangaList(res);
    }

    case "mal_update_manga_status": {
      if (!isAuthenticated) {
        throw new Error("This tool requires authentication. Please connect your MAL account via OAuth.");
      }
      const mangaId = args.manga_id as number;
      const updates = {
        status: typeof args.status === "string" ? args.status : undefined,
        score: typeof args.score === "number" ? args.score : undefined,
        num_volumes_read:
          typeof args.num_volumes_read === "number" ? args.num_volumes_read : undefined,
        num_chapters_read:
          typeof args.num_chapters_read === "number" ? args.num_chapters_read : undefined,
        start_date: typeof args.start_date === "string" ? args.start_date : undefined,
        finish_date: typeof args.finish_date === "string" ? args.finish_date : undefined,
      };
      const result = await mal.updateMangaListStatus(mangaId, updates);
      return [
        `Updated manga ${mangaId}:`,
        `  Status: ${result.status}`,
        `  Score: ${result.score}`,
        `  Chapters read: ${result.num_chapters_read}`,
        `  Volumes read: ${result.num_volumes_read}`,
        `  Updated at: ${result.updated_at}`,
      ].join("\n");
    }

    case "mal_delete_manga_from_list": {
      if (!isAuthenticated) {
        throw new Error("This tool requires authentication. Please connect your MAL account via OAuth.");
      }
      const mangaId = args.manga_id as number;
      await mal.deleteMangaFromList(mangaId);
      return `Manga ${mangaId} has been removed from your list.`;
    }

>>>>>>> Stashed changes
    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}
