import { ComparableVideo, ExternalMarketData } from '../types';
import { logger } from '../utils/logger';

type YouTubeSearchApiItem = {
  title?: string;
  publishDate?: string;
  views?: string | number;
  likes?: string | number;
  commentCount?: string | number;
  channelName?: string;
  videoLink?: string;
  thumbnail?: string;
};

type YouTubeSearchApiResponse = {
  items?: YouTubeSearchApiItem[];
  error?: string;
  details?: any;
  isBlocked?: boolean;
};

function buildSearchQueries(researchContext: string): string[] {
  const normalized = String(researchContext || '')
    .replace(/\b(?:NICHE|GENRE|DESCRIPTION)\s*:/gi, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length < 20) return [];

  const parts = normalized
    .split(/[.\n|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);

  const queries = new Set<string>();
  if (parts[0]) queries.add(parts[0].slice(0, 90));
  if (parts[1]) queries.add(parts[1].slice(0, 90));

  const genreMatch =
    normalized.match(/\b(comedy|stand[-\s]?up|interview|podcast|music|history|documentary|performance)\b/i)?.[1] || '';
  const keywordMatches =
    normalized.match(/\b([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’.-]{2,}(?:\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’.-]{2,}){0,2})\b/g) || [];

  for (const keyword of keywordMatches.filter((value) => !/^(NICHE|GENRE|DESCRIPTION|TikTok|YouTube)$/i.test(value)).slice(0, 3)) {
    queries.add([keyword, genreMatch].filter(Boolean).join(' ').slice(0, 90));
    if (genreMatch) queries.add(`${keyword} ${genreMatch} performance`.slice(0, 90));
  }

  if (genreMatch) queries.add(`${genreMatch} live performance`.slice(0, 90));

  return [...queries]
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter((query) => query.length >= 12)
    .filter((query) => !/^(comedy live performance)$/i.test(query))
    .slice(0, 5);
}

function mapComparableVideo(item: YouTubeSearchApiItem, fallbackId: number): ComparableVideo | null {
  const title = String(item?.title || '').trim();
  const videoLink = String(item?.videoLink || '').trim();
  if (!title || !videoLink) return null;

  return {
    id: videoLink || `result-${fallbackId}`,
    title,
    publishDate: String(item?.publishDate || ''),
    views: item?.views ?? 0,
    likes: item?.likes ?? 0,
    commentCount: item?.commentCount ?? 0,
    channelName: String(item?.channelName || ''),
    videoLink,
    thumbnail: item?.thumbnail || undefined,
  };
}

async function fetchSearchResults(query: string, youtubeApiKey?: string): Promise<YouTubeSearchApiResponse> {
  const params = new URLSearchParams({ q: query });
  if (youtubeApiKey) params.set('key', youtubeApiKey);

  const response = await fetch(`/api/youtube-search?${params.toString()}`);
  const data = (await response.json().catch(() => ({}))) as YouTubeSearchApiResponse;

  if (!response.ok) {
    return {
      error: data?.error || `HTTP_${response.status}`,
      details: data?.details,
      isBlocked: Boolean(data?.isBlocked),
      items: [],
    };
  }

  return {
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

export async function getExternalMarketSignals(
  researchContext: string,
  apiKey: string,
  youtubeApiKey?: string,
  modelTier?: string,
  onProgress?: (text: string) => void,
  trace?: any
): Promise<ExternalMarketData> {
  const searchQueries = buildSearchQueries(researchContext);
  const queryCount = searchQueries.length;
  const youtubeKeyStatus = youtubeApiKey ? 'ok' : 'unknown';

  if (!queryCount) {
    const reason = 'QUERY_GENERATION_FAILURE_OR_EMPTY_QUERY';
    const skipStage = 'query_generation';
    logger.info(
      `[YOUTUBE_MARKET_SKIPPED_REASON] reason=${reason} skipStage=${skipStage} youtubeKeyStatus=${youtubeKeyStatus} queryCount=${queryCount} rawResultsCount=0 filteredResultsCount=0`
    );
    if (onProgress) onProgress('Query YouTube non generate: contesto insufficiente.');
    return {
      status: 'NO_DATA',
      dataStatus: 'NO_DATA',
      comparableVideos: [],
      marketSummary: 'INVALID DATASET: Query YouTube non generate dal contesto disponibile.',
      searchQueries,
      queryCount,
      warning: 'Ricerca YouTube non eseguita: query vuote o contesto insufficiente.',
      skipReason: reason,
      skipStage,
      rawResultsCount: 0,
      filteredResultsCount: 0,
    };
  }

  if (onProgress) onProgress(`Ricerca YouTube in corso su ${queryCount} query...`);

  const deduped = new Map<string, ComparableVideo>();
  let rawResultsCount = 0;
  let blockedError: string | null = null;
  let nonBlockedErrorCount = 0;

  for (const query of searchQueries) {
    try {
      const response = await fetchSearchResults(query, youtubeApiKey);
      if (response.error) {
        if (response.isBlocked && !blockedError) blockedError = response.error;
        if (!response.isBlocked) nonBlockedErrorCount += 1;
        continue;
      }

      const items = Array.isArray(response.items) ? response.items : [];
      rawResultsCount += items.length;

      for (const [index, item] of items.entries()) {
        const mapped = mapComparableVideo(item, rawResultsCount + index);
        if (!mapped) continue;
        deduped.set(mapped.videoLink, mapped);
      }
    } catch (error: any) {
      nonBlockedErrorCount += 1;
      logger.warn(`[YOUTUBE_MARKET_QUERY_FAILED] query="${query}" error="${error?.message || 'unknown'}"`);
    }
  }

  const comparableVideos = [...deduped.values()].slice(0, 12);
  const filteredResultsCount = comparableVideos.length;

  if (!rawResultsCount) {
    const reason = blockedError ? 'YOUTUBE_API_NOT_CALLED' : 'NO_RAW_RESULTS';
    const skipStage = blockedError ? 'api_call' : 'api_call';
    logger.info(
      `[YOUTUBE_MARKET_SKIPPED_REASON] reason=${reason} skipStage=${skipStage} youtubeKeyStatus=${youtubeKeyStatus} queryCount=${queryCount} rawResultsCount=${rawResultsCount} filteredResultsCount=${filteredResultsCount}`
    );
    if (onProgress) onProgress('Nessun risultato YouTube utile recuperato.');
    return {
      status: 'NO_DATA',
      dataStatus: 'NO_DATA',
      comparableVideos: [],
      marketSummary: blockedError
        ? 'INVALID DATASET: ricerca YouTube non disponibile in questo ambiente o chiave bloccata.'
        : 'INVALID DATASET: Nessun risultato grezzo restituito dalle query YouTube.',
      searchQueries,
      queryCount,
      warning: blockedError || (nonBlockedErrorCount ? 'Ricerca YouTube fallita su tutte le query.' : 'Nessun risultato YouTube trovato.'),
      skipReason: reason,
      skipStage,
      rawResultsCount,
      filteredResultsCount,
    };
  }

  if (!filteredResultsCount) {
    const reason = 'NO_RELEVANT_VIDEOS_AFTER_FILTERING';
    const skipStage = 'filtering';
    logger.info(
      `[YOUTUBE_MARKET_SKIPPED_REASON] reason=${reason} skipStage=${skipStage} youtubeKeyStatus=${youtubeKeyStatus} queryCount=${queryCount} rawResultsCount=${rawResultsCount} filteredResultsCount=${filteredResultsCount}`
    );
    if (onProgress) onProgress('Risultati YouTube trovati ma non abbastanza rilevanti.');
    return {
      status: 'NO_DATA',
      dataStatus: 'NO_DATA',
      comparableVideos: [],
      marketSummary: 'INVALID DATASET: I risultati YouTube trovati non sono abbastanza rilevanti dopo il filtro.',
      searchQueries,
      queryCount,
      warning: 'Risultati YouTube presenti ma filtrati come non rilevanti.',
      skipReason: reason,
      skipStage,
      rawResultsCount,
      filteredResultsCount,
    };
  }

  logger.info(
    `[YOUTUBE_MARKET_SUCCESS] queryCount=${queryCount} rawResultsCount=${rawResultsCount} filteredResultsCount=${filteredResultsCount}`
  );
  if (onProgress) onProgress(`Analisi YouTube completata su ${filteredResultsCount} video comparabili.`);
  return {
    status: 'SUCCESS',
    dataStatus: 'REAL',
    comparableVideos,
    marketSummary: `Analisi di mercato completata con successo su ${filteredResultsCount} video comparabili.`,
    searchQueries,
    queryCount,
    rawResultsCount,
    filteredResultsCount,
  };
}
