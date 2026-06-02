import express from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import https from 'https';

const router = express.Router();


const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const streamTokenCache = new NodeCache({ stdTTL: 7200, checkperiod: 600 });


function generateStreamToken(url) {
    const token = crypto.randomBytes(16).toString('hex');
    streamTokenCache.set(token, url);
    return token;
}


function proxyStreamRequest(req, res, targetUrlStr, extraHeaders = {}) {
    if (res.headersSent) return;
    
    let targetUrl;
    try {
        targetUrl = new URL(targetUrlStr);
    } catch (e) {
        return res.status(400).send('Invalid target URL');
    }

    
    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['content-length'];
    delete requestHeaders['accept-encoding']; 

    const options = {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
            ...requestHeaders,
            host: targetUrl.hostname,
            ...extraHeaders,
            'Range': req.headers['range'] || 'bytes=0-', 
            'Cache-Control': 'no-cache'
        },
        timeout: 60000, 
    };

    const proxyReq = https.request(options, (proxyRes) => {
        if (res.headersSent) return;
        
        
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            const redirectUrl = new URL(proxyRes.headers.location, targetUrlStr);
            console.log(`[STREAM PROXY] Redirecting to: ${redirectUrl.toString()}`);
            return proxyStreamRequest(req, res, redirectUrl.toString(), extraHeaders);
        }
        
        
        const headers = { ...proxyRes.headers };
        delete headers['access-control-allow-origin'];
        delete headers['server'];
        delete headers['content-encoding']; 
        
        
        if (!headers['content-type'] || headers['content-type'] === 'application/octet-stream') {
            if (targetUrlStr.includes('.mp4')) headers['content-type'] = 'video/mp4';
            else if (targetUrlStr.includes('.m3u8')) headers['content-type'] = 'application/vnd.apple.mpegurl';
            else if (targetUrlStr.includes('.ts')) headers['content-type'] = 'video/mp2t';
        }

        
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        
        res.writeHead(proxyRes.statusCode || 200, headers);
        
        proxyRes.on('error', (err) => {
            console.error(`[STREAM PROXY RES ERROR] ${targetUrl.hostname}:`, err.message);
            res.end();
        });
        
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        if (res.headersSent) return;
        console.error(`[STREAM PROXY ERROR] ${targetUrl.hostname}:`, err.message);
        res.status(502).json({ error: "Bad Gateway", message: `Proxy error: ${err.message}` });
    });

    proxyReq.on('timeout', () => {
        if (res.headersSent) return;
        proxyReq.destroy();
        console.error(`[STREAM PROXY TIMEOUT] ${targetUrl.hostname}`);
        res.status(504).json({ error: "Gateway Timeout", message: 'Proxy timeout' });
    });

    if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
        req.pipe(proxyReq, { end: true });
    } else {
        proxyReq.end();
    }
}


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
    keyGenerator: (req) => {
        
        const forwardedHeader = req.headers['forwarded'];
        if (forwardedHeader) {
            const match = forwardedHeader.match(/for="?([^;"]+)"?/);
            if (match && match[1]) return match[1].trim();
        }
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            return xForwardedFor.split(',')[0].trim();
        }
        return req.ip;
    }
});


router.use(apiLimiter);


const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjc2NjM1Nzg0MjYwMzI2Njk2MzIsImF0cCI6MywiZXh0IjoxNzcyMTU4NjE1fQ.IEBtmZQL_ZTWvqbAZbb60r4aq2U9uTLTMBOS2UdVNMA";
const USER_ID = "7663578426032669632";
const X_USER_AUTH = `{"token":"${AUTH_TOKEN}","userId":"${USER_ID}","userType":0,"appType":3}`;

const baseHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-App-Version': '3.7.0',
    'X-User': X_USER_AUTH,
    'Authorization': `Bearer ${AUTH_TOKEN}`,
};


async function fetchExternal(url, options = {}, attempt = 1) {
    const isPlayer = url.includes("123movienow.cc");
    const isCineverse = url.includes("cineverse.name.ng");

    const headers = { ...baseHeaders, ...options.headers };

    if (isPlayer) {
        headers['Origin'] = 'https://123movienow.cc';
        headers['Referer'] = 'https://123movienow.cc/';
    } else if (isCineverse) {
        headers['Origin'] = 'https://cineverse.name.ng';
        headers['Referer'] = 'https://cineverse.name.ng/';
    } else {
        headers['Origin'] = 'https://moviebox.ph';
        headers['Referer'] = 'https://moviebox.ph/';
    }

    
    const delay = Math.min(attempt * 1000, 30000);

    try {
        const res = await fetch(url, { 
            ...options, 
            headers,
            signal: AbortSignal.timeout(30000) 
        });
        
        if (res.ok) {
            const data = await res.json();
            return data;
        }
        
        
        if (res.status >= 500 || res.status === 0) {
            console.warn(`[API] ${res.status || 'Timeout'} for ${url}, retry ${attempt}...`);
            await new Promise(r => setTimeout(r, delay));
            return fetchExternal(url, options, attempt + 1);
        }
        
        return res.json();
} catch (error) {
        if (error.name !== 'AbortError' && (error.message.includes('503') || error.message.includes('fetch') || error.message.includes('Failed'))) {
            console.warn(`[API] Error for ${url}: ${error.message}, retry ${attempt}...`);
            await new Promise(r => setTimeout(r, delay));
            return fetchExternal(url, options, attempt + 1);
        }
        
        console.error(`[API] Final fail ${url}, returning fallback`);
        return { results: [], success: true }; 
    }
}


router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const page = req.query.page || '1';
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                error: "Invalid request",
                message: "Search query must be at least 2 characters"
            });
        }

        const cacheKey = `search_${query}_${page}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        
        try {
            const cineverseUrl = `https://cineverse.name.ng/api/search?q=${encodeURIComponent(query)}`;
            const cineverseData = await fetchExternal(cineverseUrl);
            
            if (cineverseData && cineverseData.results && cineverseData.results.items && cineverseData.results.items.length > 0) {
                const results = cineverseData.results.items.map(item => ({
                    id: String(item.subjectId || item.id),
                    title: item.title,
                    cover: item.cover?.url || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : ''),
                    releaseDate: item.releaseDate || item.release_date || item.first_air_date || '',
                    genre: item.genre || '',
                    rating: item.imdbRatingValue || item.vote_average || 0,
                    description: item.description || item.overview || '',
                    type: item.subjectType === 2 ? 'TV Series' : 'Movie'
                }));
                
                const response = {
                    results,
                    hasMore: cineverseData.results.pager?.hasMore || false,
                    totalCount: cineverseData.results.pager?.totalCount || results.length
                };
                cache.set(cacheKey, response);
                return res.json(response);
            }
        } catch (e) {
            console.warn('[API] Cineverse search failed, falling back to metadata:', e.message);
        }

        
        const targetUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/search?keyword=${encodeURIComponent(query)}&page=${page}&perPage=24`;
        const data = await fetchExternal(targetUrl);
        
        const results = (data.data?.list || []).map(item => {
            const d = item.subject || item;
            let type = 'Movie';
            const sType = d.subjectType !== undefined ? d.subjectType : (d.type === 'TV' ? 2 : (d.type === 'Movie' ? 1 : d.type));
            if (sType === 2 || sType === 'TV Series' || d.category === 'Series' || d.type === 'TV') type = 'TV Series';
            
            let cover = '';
            if (typeof d.cover === 'string') cover = d.cover;
            else if (d.cover?.url) cover = d.cover.url;
            else if (d.thumbnail) cover = d.thumbnail;
            
            return {
                id: String(d.subjectId || d.id || d.mid || ''),
                title: d.title || d.name || d.subjectName || "Unknown",
                cover: cover,
                releaseDate: String(d.releaseDate || d.release_date || d.year || d.publish_date || ''),
                genre: d.genre || d.genres || d.categoryName || '',
                rating: d.imdbRatingValue || d.imdbRating || d.rate || d.score || d.rating || '0',
                description: d.description || d.introduction || d.summary || '',
                type: type,
                detailPath: d.detailPath || d.path || ''
            };
        });

        const response = {
            results,
            hasMore: data.data?.hasMore || false,
            totalCount: data.data?.total || results.length
        };
        
        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[API] Search error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/movie/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const detailPath = req.query.path || '';
        
        const cacheKey = `movie_${id}_${detailPath}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        let targetUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/detail?subjectId=${id}`;
        if (detailPath) {
            targetUrl += `&detailPath=${encodeURIComponent(detailPath)}`;
        }

        const data = await fetchExternal(targetUrl);
        const d = data.data?.resource || data.data || {};
        
        let type = 'Movie';
        const sType = d.subjectType !== undefined ? d.subjectType : (d.type === 'TV' ? 2 : (d.type === 'Movie' ? 1 : d.type));
        if (sType === 2 || sType === 'TV Series' || d.category === 'Series' || d.type === 'TV') type = 'TV Series';

        let cover = '';
        if (typeof d.cover === 'string') cover = d.cover;
        else if (d.cover?.url) cover = d.cover.url;
        else if (d.thumbnail) cover = d.thumbnail;
        else if (d.poster?.url) cover = d.poster.url;

        let backdrop = '';
        if (d.horizontal_cover?.url) backdrop = d.horizontal_cover.url;
        else if (d.backdrop?.url) backdrop = d.backdrop.url;

        
        let seasons = [];
        if (d.seasons && Array.isArray(d.seasons)) {
            seasons = d.seasons.map(s => ({
                id: String(s.id || s.seasonId || s.season_number || ''),
                name: s.name || s.title || `Season ${s.season_number || s.seasonNo || 1}`,
                seasonNumber: parseInt(s.season_number || s.seasonNo || 1),
                episodes: (s.episodes || s.episodeList || []).map(ep => ({
                    id: String(ep.id || ep.episodeId || ep.episode_number || ''),
                    title: ep.title || ep.name || `Episode ${ep.episode_number || ep.episodeNo || 1}`,
                    episodeNumber: parseInt(ep.episode_number || ep.episodeNo || 1),
                    overview: ep.overview || ep.description || '',
                    stillPath: ep.still_path || ep.cover?.url || ''
                }))
            }));
        }

        const response = {
            id: String(d.subjectId || d.id || d.mid || id),
            title: d.title || d.name || d.subjectName || "Unknown",
            description: d.description || d.introduction || d.summary || '',
            cover: cover,
            backdrop: backdrop,
            releaseDate: String(d.releaseDate || d.release_date || d.year || d.publish_date || ''),
            genre: d.genre || d.genres || d.categoryName || '',
            rating: d.imdbRatingValue || d.imdbRating || d.rate || d.score || d.rating || '0',
            duration: d.duration || d.runtime || '',
            cast: (d.actors || d.cast || []).map(a => a.name || a),
            director: (d.directors || d.director || []).map(d => d.name || d).join(', '),
            isSeries: type === 'TV Series',
            seasons: seasons,
            detailPath: d.detailPath || d.path || detailPath
        };

        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[API] Movie details error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/sources/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const type = req.query.type || 'Movie';
        const season = req.query.season || '1';
        const episode = req.query.episode || '1';
        const detailPath = req.query.path || '';
        
        const cacheKey = `sources_${id}_${type}_${season}_${episode}_${detailPath}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);


        try {
            let gzUrl = `https://gzmovieboxapi.septorch.tech/api/media?apikey=Godszeal&subjectId=${id}`;
            if (detailPath) {
                gzUrl += `&detailPath=${encodeURIComponent(detailPath)}`;
            }
            const isSeries = type.includes('Series') || type.includes('TV') || type.includes('Anime');
            
            if (isSeries) {
                gzUrl += `&season=${season}&episode=${episode}`;
            }
            
            let gzData = await fetchExternal(gzUrl);
            
            
            if (!isSeries && (!gzData || gzData.status !== "success" || !gzData.data?.downloads?.data?.downloads || gzData.data.downloads.data.downloads.length === 0)) {
                console.warn(`[API] GZMoviebox failed or empty for movie ${id}, retrying as series...`);
                const retryUrl = `${gzUrl}&season=${season}&episode=${episode}`;
                gzData = await fetchExternal(retryUrl);
            }
            
            if (gzData.status === "success" && gzData.data?.downloads?.data?.downloads && gzData.data.downloads.data.downloads.length > 0) {
const downloads = gzData.data.downloads.data.downloads;
                const results = downloads.map((d, i) => ({
                    id: d.id || String(i + 1),
                    quality: d.resolution,
                    stream: d.streamUrl,
                    direct: d.streamUrl,
                    download: d.downloadUrl,
                    size: d.size || 'Unknown',
                    label: `${d.resolution}p`,
                    type: 'mp4'
                }));
                
                const subsData = gzData.data.subtitles?.data?.captions || gzData.data.downloads?.data?.captions || [];
                const subs = subsData.map((s) => ({
                    lang: s.lan,
                    name: s.lanName,
                    url: s.url
                }));

                const response = { success: true, results, subtitles: subs };
                cache.set(cacheKey, response);
                return res.json(response);
            }
        } catch (e) {
            console.warn('[API] GZMoviebox failed:', e.message);
        }



        
        const isSeries = type.includes('Series') || type.includes('TV') || type.includes('Anime');
        
        let pathParams = `?subjectId=${id}`;
        if (isSeries) {
            pathParams += `&se=${season}&ep=${episode}`;
        }
        if (detailPath) {
            pathParams += `&detailPath=${encodeURIComponent(detailPath)}`;
        }
        
        // Priority 1: h5-api.aoneroom.com direct JSON API (most stable, bypasses Cloudflare)
        let primaryUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/play${pathParams}`;
        console.log(`[API] Fetching play sources from primary Aoneroom API: ${primaryUrl}`);
        let data = await fetchExternal(primaryUrl);
        
        if (!isSeries && (!data || !data.success || !data.results || data.results.length === 0)) {
            console.warn(`[API] Primary Aoneroom play failed or empty for movie ${id}, retrying as series...`);
            const retryUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/play?subjectId=${id}&se=${season}&ep=${episode}${detailPath ? `&detailPath=${encodeURIComponent(detailPath)}` : ''}`;
            data = await fetchExternal(retryUrl);
        }
        
        // Priority 2: 123movienow.cc backup proxy if primary is empty or fails (bypassed with headers)
        if (!data || !data.success || !data.results || data.results.length === 0) {
            let backupUrl = `https://123movienow.cc/wefeed-h5api-bff/subject/play${pathParams}`;
            console.log(`[API] Primary empty, attempting 123movienow.cc fallback URL: ${backupUrl}`);
            data = await fetchExternal(backupUrl);
            
            if (!isSeries && (!data || !data.success || !data.results || data.results.length === 0)) {
                console.warn(`[API] Fallback failed or empty for movie ${id}, retrying as series...`);
                const retryUrl = `https://123movienow.cc/wefeed-h5api-bff/subject/play?subjectId=${id}&se=${season}&ep=${episode}${detailPath ? `&detailPath=${encodeURIComponent(detailPath)}` : ''}`;
                data = await fetchExternal(retryUrl);
            }
        }
        
        if (data.success && data.results && data.results.length > 0) {
            const results = data.results.map(r => {
                const quality = parseInt(r.quality) || 480;
                const streamUrl = r.stream_url;
                const downloadUrl = r.download_url;
                
                const streamToken = generateStreamToken(streamUrl);
                const downloadToken = generateStreamToken(downloadUrl);

                return {
                    id: r.id || '1',
                    quality: `${quality}p`,
                    stream: `/api/stream/${streamToken}`,
                    direct: `/api/stream/${streamToken}`,
                    download: `/api/stream/${downloadToken}`,
                    size: r.size || 'Unknown',
                    type: (r.format === 'mp4' || streamUrl.includes('.mp4') || downloadUrl.includes('.mp4')) ? 'mp4' : 'hls'
                };
            });

            
            results.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

            
            if (results.length > 0) {
                results.push({
                    id: 'auto',
                    quality: 'Auto',
                    stream: results[0].stream,
                    direct: results[0].direct,
                    download: results[0].download,
                    size: 'Unknown',
                    type: results[0].type
                });
            }

            const response = { results };
            cache.set(cacheKey, response);
            return res.json(response);
        }

        res.json({ results: [] });
    } catch (error) {
        console.error('[API] Sources error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/ranking/:category', async (req, res) => {
    try {
        const category = req.params.category;
        const page = req.query.page || '1';
        
        const cacheKey = `ranking_${category}_${page}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        
        let id = '';
        let title = 'Trending Movies';
        switch (category) {
            case 'trending': id = '1001'; title = 'Trending Now'; break;
            case 'popular': id = '1002'; title = 'Popular Movies'; break;
            case 'top-rated': id = '1003'; title = 'Top Rated'; break;
            case 'new-releases': id = '1004'; title = 'New Releases'; break;
            default: id = category; title = 'Ranking List';
        }

        const targetUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/ranking-list/content?id=${id}&page=${page}&perPage=24`;
        const data = await fetchExternal(targetUrl);
        
        const results = (data.data?.list || []).map((item, index) => {
            const d = item.subject || item;
            let cover = '';
            if (typeof d.cover === 'string') cover = d.cover;
            else if (d.cover?.url) cover = d.cover.url;
            else if (d.thumbnail) cover = d.thumbnail;

            return {
                id: String(d.subjectId || d.id || d.mid || ''),
                rank: index + 1 + ((parseInt(page) - 1) * 24),
                title: d.title || d.name || d.subjectName || "Unknown",
                cover: cover,
                rating: d.imdbRatingValue || d.imdbRating || d.rate || d.score || d.rating || '0',
                releaseDate: String(d.releaseDate || d.release_date || d.year || d.publish_date || ''),
                detailPath: d.detailPath || d.path || ''
            };
        });

        const response = {
            results,
            hasMore: data.data?.hasMore || false,
            title: title,
            totalCount: data.data?.total || results.length
        };

        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[API] Ranking error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/home', async (req, res) => {
    try {
        const cacheKey = 'home_data';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const targetUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/home`;
        const data = await fetchExternal(targetUrl);
        
        const categories = [];
        const hero = [];

        if (data.data?.list) {
            data.data.list.forEach(block => {
                if (block.type === 'banner' && block.items) {
                    block.items.forEach(item => {
                        const d = item.subject || item;
                        let cover = '';
                        if (typeof d.cover === 'string') cover = d.cover;
                        else if (d.cover?.url) cover = d.cover.url;
                        else if (d.thumbnail) cover = d.thumbnail;

                        let backdrop = '';
                        if (d.horizontal_cover?.url) backdrop = d.horizontal_cover.url;
                        else if (d.backdrop?.url) backdrop = d.backdrop.url;

                        hero.push({
                            id: String(d.subjectId || d.id || d.mid || ''),
                            title: d.title || d.name || d.subjectName || "Unknown",
                            cover: cover,
                            backdrop: backdrop || cover,
                            detailPath: d.detailPath || d.path || ''
                        });
                    });
                } else if (block.items && block.items.length > 0) {
                    const items = block.items.map(item => {
                        const d = item.subject || item;
                        let cover = '';
                        if (typeof d.cover === 'string') cover = d.cover;
                        else if (d.cover?.url) cover = d.cover.url;
                        else if (d.thumbnail) cover = d.thumbnail;

                        return {
                            id: String(d.subjectId || d.id || d.mid || ''),
                            title: d.title || d.name || d.subjectName || "Unknown",
                            cover: cover,
                            rating: d.imdbRatingValue || d.imdbRating || d.rate || d.score || d.rating || '0',
                            releaseDate: String(d.releaseDate || d.release_date || d.year || d.publish_date || ''),
                            detailPath: d.detailPath || d.path || ''
                        };
                    });

                    categories.push({
                        id: block.id || block.title || 'category',
                        name: block.title || 'Featured',
                        items: items
                    });
                }
            });
        }

        const response = { categories, hero };
        cache.set(cacheKey, response);
        res.json(response);
    } catch (error) {
        console.error('[API] Home data error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.status(400).json({
                error: "Invalid request",
                message: "Search query must be at least 2 characters"
            });
        }

        const cacheKey = `suggestions_${query}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const firstLetter = query.charAt(0).toLowerCase();
        const targetUrl = `https://v3.sg.media-imdb.com/suggestion/x/${firstLetter}/${encodeURIComponent(query)}.json`;
        
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`IMDb Error: ${response.status}`);
        
        const data = await response.json();
        cache.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('[API] Suggestions error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Service temporarily unavailable"
        });
    }
});


router.get('/stream/:token', (req, res) => {
    const tokenOrUrl = req.params.token;
    
    
    let targetUrl = streamTokenCache.get(tokenOrUrl);
    
    
    if (!targetUrl) {
        try {
            const decoded = decodeURIComponent(tokenOrUrl);
            if (decoded.startsWith('http')) {
                targetUrl = decoded;
            }
        } catch (e) {
            
        }
    }
    
    if (!targetUrl) {
        return res.status(404).send('Stream not found or expired');
    }
    
    let targetHost;
    try {
        const urlObj = new URL(targetUrl);
        targetHost = urlObj.hostname;
    } catch (e) {
        return res.status(400).send('Invalid target URL');
    }
    
    console.log(`[STREAM PROXY] Forwarding ${tokenOrUrl.substring(0, 8)}... to ${targetHost}`);
    
    proxyStreamRequest(req, res, targetUrl, {
        'Origin': `https://${targetHost}`,
        'Referer': `https://${targetHost}/`
    });
});

export default router;
