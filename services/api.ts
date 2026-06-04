import { MovieResult, CastMember, Season, CategoryData, VideoSource, Subtitle, ImdbSuggestion } from '../types';
import { cacheService, CacheService } from './cache';
import { safeConsole } from '../utils/productionGuard';



const VIRTUAL_API_PATH = "/slflix/api/v1";


const convertSrtToVtt = (srtContent: string): string => {
    if (srtContent.trim().startsWith('WEBVTT')) {
        return srtContent;
    }
    
    
    let vtt = 'WEBVTT\n\n';
    
    
    const lines = srtContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        
        if (!line) continue;
        
        
        if (line.includes('-->')) {
            
            line = line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/, '$1.$2');
            
            line = line.replace(/,/g, '.');
            vtt += line + '\n';
        } else if (!isNaN(Number(line)) && line.includes('\n')) {
            
            
            continue;
        } else {
            
            
            line = line
                .replace(/</g, '<')
                .replace(/>/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/"/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'");
            vtt += line + '\n';
        }
    }
    
    return vtt;
};


const vttBlobCache = new Map<string, string>();


const convertSrtUrlToVttBlob = async (srtUrl: string): Promise<string> => {
    
    if (vttBlobCache.has(srtUrl)) {
        return vttBlobCache.get(srtUrl)!;
    }
    
    try {
        let response;
        try {
            
            response = await fetch(srtUrl, {
                headers: {
                    'Referer': 'https://123movienow.cc/',
                    'Origin': 'https://123movienow.cc'
                }
            });
        } catch (e) {
            safeConsole.warn('[Subtitle] Direct fetch failed, trying CORS proxy for:', srtUrl);
            response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(srtUrl)}`);
        }
        
        if (!response || !response.ok) {
            safeConsole.warn('[Subtitle] Failed to fetch SRT:', response?.status);
            return srtUrl; 
        }
        
        const srtContent = await response.text();
        
        
        if (!srtContent.includes('-->')) {
            safeConsole.warn('[Subtitle] Invalid SRT content');
            return srtUrl; 
        }
        
        const vttContent = convertSrtToVtt(srtContent);
        
        
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const blobUrl = URL.createObjectURL(blob);
        
        
        vttBlobCache.set(srtUrl, blobUrl);
        
        safeConsole.log('[Subtitle] Converted SRT to VTT, blob URL created');
        return blobUrl;
    } catch (error) {
        safeConsole.warn('[Subtitle] Error converting SRT to VTT:', error);
        return srtUrl; 
    }
};


const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjc2NjM1Nzg0MjYwMzI2Njk2MzIsImF0cCI6MywiZXh0IjoxNzcyMTU4NjE1fQ.IEBtmZQL_ZTWvqbAZbb60r4aq2U9uTLTMBOS2UdVNMA";
const USER_ID = "7663578426032669632";
const X_USER_AUTH = `{"token":"${AUTH_TOKEN}","userId":"${USER_ID}","userType":0,"appType":3}`;


async function fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    retries: number = 10,
    delay: number = 2000
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchFn();
        } catch (error) {
            lastError = error as Error;
            safeConsole.warn(`[API] Retry ${i + 1}/${retries} failed:`, error);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
    throw lastError;
}


async function fetchJson(url: string, options: RequestInit = {}) {
    const isPlayer = url.includes("api-player");
    const isCineverse = url.includes("api-cineverse");

    const baseHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App-Version': '3.7.0',
        'X-User': X_USER_AUTH,
        'Authorization': `Bearer ${AUTH_TOKEN}`,
    };

    
    if (isPlayer) {
        baseHeaders['Origin'] = 'https://123movienow.cc';
        baseHeaders['Referer'] = 'https://123movienow.cc/';
    } else if (isCineverse) {
        baseHeaders['Origin'] = 'https://cineverse.name.ng';
        baseHeaders['Referer'] = 'https://cineverse.name.ng/';
    }

    const res = await fetch(url, { ...options, headers: { ...baseHeaders, ...options.headers } });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return res.json();
}


async function internalFetch(virtualEndpoint: string, options: RequestInit = {}): Promise<any> {
    const [pathPart, queryPart] = virtualEndpoint.split('?');
    const params = new URLSearchParams(queryPart || '');
    
    const cleanPath = pathPart.replace(VIRTUAL_API_PATH, '');
    
    if (cleanPath.startsWith('/search')) {
        const keyword = params.get('q') || '';
        const page = params.get('page') || '1';
        const targetUrl = `/api-metadata/search?keyword=${encodeURIComponent(keyword)}&page=${page}&perPage=24`;
        return fetchJson(targetUrl, options);
    }
    
    if (cleanPath.startsWith('/home')) {
        return fetchJson('/api-metadata/home', options);
    }
    
    if (cleanPath.startsWith('/trending_search')) {
        return fetchJson('/api-metadata/subject/everyone-search', options);
    }
    
    if (cleanPath.startsWith('/ranking')) {
        const id = params.get('id') || '';
        const page = params.get('page') || '1';
        const perPage = params.get('perPage') || '12';
        return fetchJson(`/api-metadata/ranking-list/content?id=${id}&page=${page}&perPage=${perPage}`, options);
    }
    
    if (cleanPath.startsWith('/detail')) {
        const subjectId = params.get('subjectId') || '';
        const detailPath = params.get('path') || params.get('detailPath') || '';
        
        if (detailPath && !/^\d+$/.test(detailPath)) {
            return fetchJson(`/api-metadata/detail?detailPath=${encodeURIComponent(detailPath)}`, options);
        }
        return fetchJson(`/api-metadata/detail?subjectId=${subjectId}&detailPath=${encodeURIComponent(detailPath)}`, options);
    }
    
    if (cleanPath.startsWith('/play')) {
        const subjectId = params.get('subjectId') || '';
        const se = params.get('se') || '0';
        const ep = params.get('ep') || '0';
        const detailPath = params.get('detailPath') || '';
        const targetUrl = `/api-player/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}${detailPath ? `&detailPath=${encodeURIComponent(detailPath)}` : ''}`;
        return fetchJson(targetUrl, options);
    }
    
    if (cleanPath.startsWith('/rec')) {
        const id = params.get('id') || '';
        return fetchJson(`/api-metadata/subject/detail-rec?subjectId=${id}&page=1&perPage=12`, options);
    }
    
    return { code: -1, message: 'Unknown endpoint', data: null };
}


const normalizeItem = (item: any): MovieResult => {
    if (!item) return {} as MovieResult;
    const d = item.subject || item.data || item;
    
    let type = 'Movie';
    const sType = d.subjectType !== undefined ? d.subjectType : (d.type === 'TV' ? 2 : (d.type === 'Movie' ? 1 : d.type));
    if (sType === 2 || sType === 'TV Series' || d.category === 'Series' || d.type === 'TV') type = 'TV Series';
    else if (sType === 6) type = 'Music Video';
    else if (sType === 7) type = 'Short TV';
    else if (sType === 9 || d.category === 'Sport') type = 'Live Sport';

    let cover = '';
    if (typeof d.cover === 'string') cover = d.cover;
    else if (d.cover?.url) cover = d.cover.url;
    else if (d.thumbnail) cover = d.thumbnail;
    else if (d.image?.url) cover = d.image.url;
    else if (d.pic?.normal) cover = d.pic.normal;
    else if (d.poster?.url) cover = d.poster.url;
    else if (d.horizontal_cover?.url) cover = d.horizontal_cover.url;

    const description = d.description || d.introduction || d.synopsis || d.content || d.summary || d.desc || d.info || d.description_en || d.introduction_en || d.summary_en || d.postTitle;
    const rating = d.imdbRatingValue || d.imdbRating || d.rate || d.score || d.rating || '0';

    return {
        title: d.title || d.name || d.subjectName || "Unknown",
        cover: cover,
        thumbnail: cover,
        type: type,
        subjectId: String(d.subjectId || d.id || d.mid || ''),
        imdbRating: String(rating),
        releaseDate: String(d.releaseDate || d.release_date || d.year || d.publish_date || ''),
        genre: d.genre || d.genres || d.categoryName || '',
        description: description || '',
        countryName: d.countryName || d.country || '',
        detailPath: d.detailPath || d.path || '',
        hasResource: d.hasResource !== undefined ? d.hasResource : true
    };
};


const normalizeRankingItem = (item: any): MovieResult => {
    if (!item) return {} as MovieResult;
    
    let cover = '';
    if (typeof item.cover === 'string') cover = item.cover;
    else if (item.cover?.url) cover = item.cover.url;
    
    return {
        title: item.title || "Unknown",
        cover: cover,
        thumbnail: cover,
        type: item.subjectType === 1 ? 'Movie' : (item.subjectType === 2 ? 'TV Series' : 'Movie'),
        subjectId: String(item.subjectId || ''),
        imdbRating: String(item.imdbRatingValue || '0'),
        releaseDate: String(item.releaseDate || ''),
        genre: item.genre || '',
        description: item.description || '',
        countryName: item.countryName || '',
        detailPath: item.detailPath || '',
        hasResource: item.hasResource !== undefined ? item.hasResource : true
    };
};


const CATEGORY_IDS: Record<string, string> = {
    'trending': '1232643093049001320',
    'movies': '997144265920760504',
    'anime': '62133389738001440',
    'nollywood': '8216283712045280',
    'sa_series': '4307848214843217008',
    'black_drama': '8505361996374835640',
    'western': '2540573817806670120',
    'k_drama': '4380734070238626200',
    'c_drama': '173752404280836544',
    'thai_drama': '1164329479448281992',
    'turkish': '9193088611682599936',
    'animation': '7132534597631837112'
};

export const ApiService = {
    
    search: async (query: string, page: number = 1) => {
        if (!query || !query.trim()) return { results: [], hasMore: false, nextPage: 1, totalCount: 0 };
        
        const cacheKey = CacheService.searchKey(query, page);
        
        if (page === 1) {
            const cached = cacheService.get<{ results: MovieResult[]; hasMore: boolean; nextPage: number; totalCount: number }>(cacheKey);
            if (cached && cached.data) {
                cacheService.prefetch(cacheKey, () => ApiService.search(query, page), 3 * 60 * 1000);
                return cached.data;
            }
        }
        
        try {
            // Priority 1: Dixon Omega Search API
            const omegatechUrl = `/api-omegatech/api/movie/moviebox-search?q=${encodeURIComponent(query.trim())}&page=${page}`;
            try {
                const res = await fetch(omegatechUrl);
                const data = await res.json();
                console.log('[SL-FLIX] Dixon Omega search response:', data);
                if (data && data.success && Array.isArray(data.result)) {
                    const results: MovieResult[] = data.result.map((item: any) => ({
                        title: item.title || "Unknown",
                        cover: item.cover || '',
                        thumbnail: item.cover || '',
                        type: item.type === 2 ? 'TV Series' : (item.type === 6 ? 'Music Video' : 'Movie'),
                        subjectId: String(item.id || ''),
                        imdbRating: String(item.rating || '0'),
                        releaseDate: String(item.year || ''),
                        genre: '',
                        description: '',
                        countryName: '',
                        detailPath: item.path || '',
                        hasResource: true
                    }));
                    const result = {
                        results,
                        hasMore: results.length >= 12,
                        nextPage: page + 1,
                        totalCount: data.total || results.length
                    };
                    
                    if (page === 1) {
                        cacheService.set(cacheKey, result, 3 * 60 * 1000);
                    }
                    return result;
                }
            } catch (err) {
                console.warn('[SL-FLIX] Dixon Omega search failed, trying fallback:', err);
            }

            // Priority 2: Metadata-based search (Fallback)
            const metaUrl = `/api-metadata/search?keyword=${encodeURIComponent(query.trim())}&page=${page}&perPage=24`;
            let result = null;
            try {
                const metaData = await fetchJson(metaUrl);
                console.log('[SL-FLIX] Metadata search response:', metaData);
                const items = metaData.data?.searchResults || metaData.data?.subjectList || metaData.data?.items || metaData.data?.list;
                if (metaData.code === 0 && Array.isArray(items)) {
                    const pager = metaData.data?.pager || {};
                    result = {
                        results: items.map(normalizeRankingItem),
                        hasMore: pager.hasMore || false,
                        nextPage: parseInt(pager.nextPage) || (page + 1),
                        totalCount: pager.totalCount || items.length
                    };
                }
            } catch (err) {
                console.warn('[SL-FLIX] Metadata search failed, falling back to Cineverse:', err);
            }

            if (result) {
                if (page === 1) {
                    cacheService.set(cacheKey, result, 3 * 60 * 1000);
                }
                return result;
            }

            // Fallback: Cineverse search
            const url = `/api-cineverse/api/search?q=${encodeURIComponent(query.trim())}&page=${page}&perPage=24`;
            const data = await fetchJson(url);
            
            console.log('[SL-FLIX] Cineverse search response:', data);
            
            if (data.success && data.results?.items) {
                const pager = data.results.pager || {};
                const cineverseResult = {
                    results: data.results.items.map(normalizeItem),
                    hasMore: pager.hasMore || false,
                    nextPage: parseInt(pager.nextPage) || (page + 1),
                    totalCount: pager.totalCount || 0
                };
                
                if (page === 1) {
                    cacheService.set(cacheKey, cineverseResult, 3 * 60 * 1000);
                }
                
                return cineverseResult;
            }
            
            return { results: [], hasMore: false, nextPage: 1, totalCount: 0 };
        } catch (e) {
            console.error('[SL-FLIX] Search error:', e);
            
            const cached = cacheService.get<{ results: MovieResult[]; hasMore: boolean; nextPage: number; totalCount: number }>(cacheKey);
            if (cached && cached.data) {
                return cached.data;
            }
            
            return { results: [], hasMore: false, nextPage: 1, totalCount: 0 };
        }
    },

    
    getHomeData: async () => {
        const cacheKey = 'home:data';
        
        
        const cached = cacheService.get<{ categories: CategoryData[]; hero: MovieResult[] }>(cacheKey);
        if (cached && cached.data && !cached.isStale) {
            
            cacheService.prefetch(cacheKey, () => ApiService.getHomeData(), 5 * 60 * 1000);
            return cached.data;
        }
        
        try {
            const data = await fetchWithRetry(
                () => internalFetch(`${VIRTUAL_API_PATH}/home`),
                2, 1
            );
            
            if (data.code !== 0 || !data.data?.operatingList) {
                
                const staleCached = cacheService.get<{ categories: CategoryData[]; hero: MovieResult[] }>(cacheKey);
                return staleCached?.data || { categories: [], hero: [] };
            }
            
            const categories: any[] = [];
            let hero: MovieResult[] = [];
            
            data.data.operatingList.forEach((op: any) => {
                if (op.type === 'BANNER' && op.banner?.items) {
                    hero = op.banner.items.map(normalizeItem);
                } else if ((op.type === 'SUBJECTS_MOVIE' || op.type === 'SUBJECT_LIST' || op.type === 'APPOINTMENT_LIST') && op.subjects?.length) {
                    categories.push({ title: op.title || "Recommended", movies: op.subjects.map(normalizeItem) });
                } else if (op.type === 'CUSTOM' && op.customData?.items?.length) {
                    categories.push({ title: op.title || "Curated Picks", movies: op.customData.items.map(normalizeItem) });
                } else if (op.type === 'SPORT_LIVE' && op.liveList?.length) {
                    categories.push({ title: `Live ${op.title}`, isLive: true, movies: op.liveList.map((item: any) => {
                        const n = normalizeItem(item);
                        return { ...n, title: item.title || (item.team1 && item.team2 ? `${item.team1.name} vs ${item.team2.name}` : "Live Match"), type: "Live Sport", subjectId: String(item.matchId || item.id) };
                    })});
                }
            });
            
            const result = { categories, hero };
            
            
            cacheService.set(cacheKey, result, 5 * 60 * 1000);
            
            return result;
        } catch (e) {
            console.error('[SL-FLIX] Home data error:', e);
            
            
            const cached = cacheService.get<{ categories: CategoryData[]; hero: MovieResult[] }>(cacheKey);
            return cached?.data || { categories: [], hero: [] };
        }
    },

    
    getDetails: async (movie: MovieResult) => {
        let enhanced = { ...movie };
        const path = movie.detailPath;
        const subjectId = movie.subjectId;
        const cacheKey = CacheService.movieKey(subjectId, path);
        
        
        const cached = cacheService.get<MovieResult>(cacheKey);
        if (cached && cached.data && !cached.isStale) {
            return { ...cached.data, ...movie };
        }
        
        if (path || subjectId) {
            try {
                const data = await fetchWithRetry(
                    () => internalFetch(`${VIRTUAL_API_PATH}/detail?subjectId=${subjectId || ''}&path=${path || ''}`),
                    2, 1
                );
                
                if (data.code === 0 && data.data) {
                    const d = data.data;
                    const s = d.subject || d.subjectDetail || d.detail || d.info || d.data || d;
                    
                    enhanced.description = s.description || s.introduction || s.synopsis || s.content || s.summary || s.desc || enhanced.description;
                    enhanced.title = s.title || s.name || s.subjectName || enhanced.title;
                    enhanced.imdbRating = String(s.imdbRatingValue || s.imdbRating || enhanced.imdbRating);
                    enhanced.subjectId = String(s.subjectId || enhanced.subjectId);
                    enhanced.detailPath = s.detailPath || enhanced.detailPath;
                    if (s.hasResource !== undefined) enhanced.hasResource = s.hasResource;

                    const coverUrl = s.cover?.url || s.pic?.normal || s.image?.url || s.cover || s.poster?.url;
                    if (coverUrl && typeof coverUrl === 'string') enhanced.cover = coverUrl;

                    const stars = d.stars || s.staffList || d.staffList || s.stars || s.actors;
                    if (stars && Array.isArray(stars)) {
                        enhanced.cast = stars.map((st: any) => ({ name: st.name || st.staffName || "Unknown", character: st.character || st.role || '', avatar: st.avatarUrl || st.avatar || '', id: String(st.staffId || st.id || '') }));
                    }

                    
                    let seasons: any[] = [];
                    
                    
                    if (d.resource?.seasons && Array.isArray(d.resource.seasons)) {
                        seasons = d.resource.seasons;
                        console.log('[SL-FLIX] Seasons from d.resource.seasons:', seasons);
                    }
                    
                    else if (s.resource?.seasons && Array.isArray(s.resource.seasons)) {
                        seasons = s.resource.seasons;
                    }
                    
                    else if (s.seasons && Array.isArray(s.seasons)) {
                        seasons = s.seasons;
                    }
                    
                    else if (d.seasons && Array.isArray(d.seasons)) {
                        seasons = d.seasons;
                    }
                    
                    else if (s.episodes && Array.isArray(s.episodes)) {
                        const seasonMap = new Map<number, number>();
                        s.episodes.forEach((ep: any) => {
                            const sn = ep.seasonNumber || ep.season || 1;
                            seasonMap.set(sn, (seasonMap.get(sn) || 0) + 1);
                        });
                        seasons = Array.from(seasonMap.entries()).map(([seasonNumber, episodeCount]) => ({
                            se: seasonNumber,
                            maxEp: episodeCount,
                            episodeCount
                        }));
                    }
                    
                    else if (s.totalEpisodes && s.totalSeasons) {
                        for (let i = 1; i <= (s.totalSeasons || 1); i++) {
                            seasons.push({
                                se: i,
                                maxEp: s.totalEpisodes,
                                episodeCount: s.totalEpisodes
                            });
                        }
                    }

                    if (seasons.length > 0) {
                        enhanced.seasons = seasons.map((se: any) => ({ 
                            seasonNumber: se.seasonNumber || se.se || 1, 
                            episodeCount: se.maxEp || se.episodeCount || se.totalEpisodes || 12 
                        }));
                        console.log('[SL-FLIX] Seasons extracted:', enhanced.seasons);
                    } else if (s.type === 'TV Series' || s.subjectType === 2 || s.category === 'Series') {
                        enhanced.seasons = [{ seasonNumber: 1, episodeCount: s.episodeCount || s.totalEpisodes || 12 }];
                    }
                    
                    enhanced.trailerUrl = s.trailer?.videoAddress?.url || s.trailer?.url || s.trailerUrl;
                    if (s.dubs) enhanced.dubs = s.dubs;
                    
                    
                    cacheService.set(cacheKey, enhanced, 10 * 60 * 1000);
                }
            } catch (e) {
                console.warn("[SL-FLIX] Detail metadata failed", e);
            }
        }
        
        const recId = enhanced.subjectId;
        if (recId && recId !== 'undefined') {
            try {
                const recData = await internalFetch(`${VIRTUAL_API_PATH}/rec?id=${recId}`);
                const recItems = recData.data?.items || recData.data?.list || [];
                if (Array.isArray(recItems)) {
                    enhanced.recommendations = recItems.map(normalizeItem);
                }
            } catch (e) {
                console.warn("[SL-FLIX] Recommendations failed", e);
            }
        }
        
        return enhanced;
    },

    
    getSources: async (subjectId: string, type: string, season = 1, episode = 1, detailPath?: string) => {
        const cacheKey = CacheService.sourcesKey(subjectId, season, episode);
        
        
        const cached = cacheService.get<{ videos: VideoSource[]; subs: Subtitle[] }>(cacheKey);
        if (cached && cached.data && !cached.isStale) {
            return cached.data;
        }
        
        try {
            let url = `/api/sources/${subjectId}?type=${encodeURIComponent(type)}&season=${season}&episode=${episode}`;
            if (detailPath) {
                url += `&path=${encodeURIComponent(detailPath)}`;
            }
            
            console.log('[SL-FLIX] Getting sources from:', url);
            const data = await fetchWithRetry(
                () => fetchJson(url),
                10, 3000
            );
            
            console.log('[SL-FLIX] Sources response:', data);
            
            if (data.results && data.results.length > 0) {
                const videos: VideoSource[] = data.results.map((r: any) => {
                    const quality = parseInt(r.quality) || 480;
                    return {
                        id: r.id || '1',
                        quality: quality,
                        stream: r.stream,
                        direct: r.direct,
                        download: r.download,
                        size: r.size,
                        label: r.label || `${quality}p`,
                        type: r.type || 'mp4'
                    };
                });
                
                
                videos.sort((a, b) => b.quality - a.quality);
                
                
                videos.push({
                    id: 'auto',
                    quality: 0,
                    stream: videos[0]?.stream,
                    direct: videos[0]?.direct,
                    label: 'Auto',
                    type: videos[0]?.type || 'mp4'
                });
                
                const subs: Subtitle[] = (data.subtitles || []).map((s: any) => ({
                    lang: s.lang,
                    name: s.name,
                    url: s.url
                }));

                console.log('[SL-FLIX] Sources found:', videos.length, 'subs:', subs.length);
                
                const result = { videos, subs };
                
                
                cacheService.set(cacheKey, result, 2 * 60 * 1000);
                
                return result;
            }
            
            console.warn('[SL-FLIX] No sources found');
            return { videos: [], subs: [] };
        } catch (e) {
            console.error("[SL-FLIX] Sources fetch failed", e);
            
            
            const cached = cacheService.get<{ videos: VideoSource[]; subs: Subtitle[] }>(cacheKey);
            if (cached?.data) {
                return cached.data;
            }
            
            return { videos: [], subs: [] };
        }
    },

    
    getTrendingSearches: async () => {
        const cacheKey = 'trending:searches';
        
        const cached = cacheService.get<string[]>(cacheKey);
        if (cached?.data) {
            cacheService.prefetch(cacheKey, () => ApiService.getTrendingSearches(), 2 * 60 * 1000);
            return cached.data;
        }
        
        try {
            const data = await internalFetch(`${VIRTUAL_API_PATH}/trending_search`);
            const result = data.data?.everyoneSearch?.map((s: any) => s.title) || [];
            cacheService.set(cacheKey, result, 2 * 60 * 1000);
            return result;
        } catch (e) { 
            const cached = cacheService.get<string[]>(cacheKey);
            return cached?.data || [];
        }
    },

    
    getTrending: async (page: number = 0, perPage: number = 18) => {
        const cacheKey = `trending:${page}:${perPage}`;
        
        const cached = cacheService.get<{ results: MovieResult[]; hasMore: boolean; nextPage: number; totalCount: number }>(cacheKey);
        if (cached?.data) {
            cacheService.prefetch(cacheKey, () => ApiService.getTrending(page, perPage), 2 * 60 * 1000);
            return cached.data;
        }
        
        try {
            const url = `/api-metadata/subject/trending?page=${page}&perPage=${perPage}`;
            const data = await fetchJson(url);
            
            console.log('[API] Trending response:', data);
            
            if (data.code === 0 && data.data?.subjectList) {
                const pager = data.data.pager || {};
                const result = {
                    results: data.data.subjectList.map(normalizeRankingItem),
                    hasMore: pager.hasMore || false,
                    nextPage: parseInt(pager.nextPage) || (page + 1),
                    totalCount: pager.totalCount || data.data.subjectList.length
                };
                cacheService.set(cacheKey, result, 2 * 60 * 1000);
                return result;
            }
            
            return { results: [], hasMore: false, nextPage: page + 1, totalCount: 0 };
        } catch (e) {
            console.error('[API] Trending error:', e);
            const cached = cacheService.get<{ results: MovieResult[]; hasMore: boolean; nextPage: number; totalCount: number }>(cacheKey);
            return cached?.data || { results: [], hasMore: false, nextPage: 1, totalCount: 0 };
        }
    },

    
    getRankingList: async (category: string, page: number = 1, perPage: number = 12) => {
        try {
            const catId = CATEGORY_IDS[category.toLowerCase()] || CATEGORY_IDS['trending'];
            const data = await internalFetch(`${VIRTUAL_API_PATH}/ranking?id=${catId}&page=${page}&perPage=${perPage}`);
            
            if (data.code === 0 && data.data?.subjectList) {
                const pager = data.data.pager || {};
                return {
                    title: data.data.title || category,
                    results: data.data.subjectList.map(normalizeRankingItem),
                    hasMore: pager.hasMore || false,
                    nextPage: parseInt(pager.nextPage) || (page + 1)
                };
            }
            
            return { title: category, results: [], hasMore: false, nextPage: page + 1 };
        } catch (e) {
            console.error('[SL-FLIX] Ranking list error:', e);
            return { title: category, results: [], hasMore: false, nextPage: page + 1 };
        }
    },

    
    getImdbSuggestions: async (query: string) => {
        try {
            const clean = query.replace(/[^\w\s]/g, '').trim();
            if (clean.length < 2) return [];
            const url = `https://v3.sg.media-imdb.com/suggestion/${clean.charAt(0).toLowerCase()}/${encodeURIComponent(clean)}.json`;
            const res = await fetch(url);
            const data = await res.json();
            return data?.d || [];
        } catch (e) { return []; }
    },

    getMovieById: async (id: string): Promise<MovieResult> => ({
        title: "Loading...", cover: "", thumbnail: "", type: "Movie", subjectId: id, detailPath: id
    })
};


export const RANKING_CATEGORIES = [
    { id: 'trending', name: 'Trending Now', icon: 'fa-fire' },
    { id: 'movies', name: 'Popular Movies', icon: 'fa-film' },
    { id: 'anime', name: 'Anime', icon: 'fa-dragon' },
    { id: 'k_drama', name: 'K-Drama', icon: 'fa-heart' },
    { id: 'c_drama', name: 'C-Drama', icon: 'fa-scroll' },
    { id: 'thai_drama', name: 'Thai-Drama', icon: 'fa-spa' },
    { id: 'turkish', name: 'Turkish Drama', icon: 'fa-star' },
    { id: 'western', name: 'Western TV', icon: 'fa-tv' },
    { id: 'nollywood', name: 'Nollywood', icon: 'fa-mask' },
    { id: 'sa_series', name: 'South African', icon: 'fa-globe-africa' },
    { id: 'black_drama', name: 'Black Drama', icon: 'fa-users' },
    { id: 'animation', name: 'Animation', icon: 'fa-ghost' }
];

export const CATEGORIES: any[] = [];

