

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoSource, Subtitle, Season, MovieResult, MovieDub } from '../types';
import Hls from 'hls.js';
import SubtitleManager, { detectUserLanguage, findBestSubtitle } from './SubtitleManager';
import SeasonSelector from './SeasonSelector';
import BulkDownloadModal from './BulkDownloadModal';
import VideoPlayerBulkModalWrapper from './VideoPlayerBulkModalWrapper';


interface VideoPlayerProps {
  title: string;
  subTitle?: string;
  sources: VideoSource[];
  subtitles?: Subtitle[];
  onClose: () => void;
  minimized?: boolean;
  overlay?: boolean;
  onToggleMinimize?: () => void;
  subjectId?: string;
  initialTime?: number;
  onProgressUpdate?: (time: number, duration: number) => void;
  nextEpisode?: { season: number; episode: number; title?: string; };
  onPlayNext?: () => void;
  isTrailer?: boolean;
  isLive?: boolean;
  startTime?: number;

  movie?: MovieResult;
  currentSeason?: number;
  currentEpisode?: number;
  onSeasonChange?: (season: number) => void;
  onEpisodeChange?: (season: number, episode: number) => void;
  
  showBulkDownload?: boolean;
  onToggleBulkDownload?: () => void;
  movieId?: string;
  seasonNumber?: number;
  onDubSelect?: (dub: MovieDub) => void;
}


const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === Infinity || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};


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
      console.warn('[Subtitle] Direct fetch failed, trying CORS proxy for:', srtUrl);
      response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(srtUrl)}`);
    }
    
    if (!response || !response.ok) {
      return srtUrl;
    }
    
    const srtContent = await response.text();
    
    if (!srtContent.includes('-->')) {
      return srtUrl;
    }
    
    const vttContent = convertSrtToVtt(srtContent);
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);
    
    vttBlobCache.set(srtUrl, blobUrl);
    console.log('[Subtitle] Converted SRT to VTT blob URL');
    return blobUrl;
  } catch (error) {
    console.warn('[Subtitle] Error converting SRT to VTT:', error);
    return srtUrl;
  }
};


const getYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};


const FastStreamLoader: React.FC<{ buffered?: number }> = ({ buffered }) => {
  return (
    <div className="flex flex-col items-center p-8">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-white/20 rounded-full animate-spin border-t-primary"></div>
        <div className="absolute inset-0 w-20 h-20 border-4 border-transparent rounded-full bg-gradient-to-r from-primary/20 to-transparent animate-spin-slow border-l-primary"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-black animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.665z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div className="w-80 mt-8 mx-auto">
        <div className="relative h-3 bg-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/50 to-white/20 rounded-2xl"></div>
          <div 
            className="h-full bg-gradient-to-r from-primary via-blue-500 to-indigo-500 rounded-2xl relative shadow-primary/50 overflow-hidden transition-all duration-500 ease-out"
            style={{ width: `${Math.min((buffered || 0) * 100, 100)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform translate-x-[-100%] animate-shimmer-smooth"></div>
          </div>
          {(buffered || 0) > 0 && (
            <div 
              className="absolute right-0 top-0 h-full w-1 bg-white/50 rounded-r-lg shadow-lg"
              style={{ right: `${100 - (buffered || 0) * 100}%` }}
            />
          )}
        </div>
      </div>

      
      <div className="mt-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-fast"></div>
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-fast delay-100"></div>
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-fast delay-200"></div>
        </div>
        <span className="text-white/80 text-sm font-medium tracking-wide">Loading Stream</span>
        {buffered && buffered > 0 && (
          <span className="text-primary/80 text-xs mt-1 block font-mono">
             {Math.round((buffered || 0) * 100)}% buffered
          </span>
        )}
      </div>
    </div>
  );
};



const TrailerPlayer: React.FC<{
  title: string;
  sources: VideoSource[];
  onClose: () => void;
  coverImage?: string;
}> = ({ title, sources, onClose, coverImage }) => {
  const trailerUrl = sources[0]?.stream || sources[0]?.direct || "";
  
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center animate-fade-in">
      {coverImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40" 
          style={{ backgroundImage: `url(${coverImage})` }} 
        />
      )}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
      
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        <i className="fa-solid fa-times"></i>
      </button>
      
      <div className="relative z-10 w-full max-w-4xl mx-4">
        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          {getYoutubeId(trailerUrl) ? (
            <iframe 
              src={`https://www.youtube.com/embed/${getYoutubeId(trailerUrl)}?autoplay=1&rel=0`} 
              className="w-full h-full" 
              allowFullScreen 
              title={title} 
            />
          ) : (
            <video 
              src={trailerUrl} 
              controls 
              autoPlay 
              className="w-full h-full object-contain" 
            />
          )}
        </div>
        <div className="mt-4 text-center">
          <h2 className="text-white font-bold text-lg">{title}</h2>
        </div>
      </div>
    </div>
  );
};


const StreamingPlayer: React.FC<VideoPlayerProps> = ({ 
  title, 
  subTitle, 
  sources, 
  subtitles = [], 
  onClose, 
  minimized = false, 
  onToggleMinimize,
  initialTime = 0, 
  onProgressUpdate, 
  nextEpisode, 
  onPlayNext, 
  isLive = false,
  movie,
  currentSeason = 1,
  currentEpisode = 1,
  onSeasonChange,
  onEpisodeChange,
  onDubSelect
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [locked, setLocked] = useState(false);
  
  
  const [showSettings, setShowSettings] = useState(false);
  const [showSourceSelect, setShowSourceSelect] = useState(false);
  const [showSeasonSelector, setShowSeasonSelector] = useState(false);
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [resizeMode, setResizeMode] = useState<'contain' | 'cover'>('contain');
  const [activeSourceIndex, setActiveSourceIndex] = useState(() => {
    const saved = localStorage.getItem('slflix_preferred_quality');
    return 0; 
  });
  const [preferredQuality, setPreferredQuality] = useState(() => {
    return localStorage.getItem('slflix_preferred_quality') || 'Auto';
  });
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [convertedSubUrls, setConvertedSubUrls] = useState<Record<number, string>>({});
  const [isConvertingSubs, setIsConvertingSubs] = useState(false);
  
  
  const [networkState, setNetworkState] = useState<'good' | 'unstable' | 'offline'>('good');
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showReconnected, setShowReconnected] = useState(false);

  const [jumpIndicator, setJumpIndicator] = useState<{ type: 'forward' | 'backward' | 'play' | 'pause'; visible: boolean; text?: string } | null>(null);
  const jumpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerVisualFeedback = useCallback((type: 'forward' | 'backward' | 'play' | 'pause', text?: string) => {
    setJumpIndicator({ type, visible: true, text });
    if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current);
    jumpTimeoutRef.current = setTimeout(() => {
      setJumpIndicator(null);
    }, 850);
  }, []);

  
  const attemptPlay = useCallback(() => { 
    const video = videoRef.current; 
    if (!video) return; 
    video.play().catch(() => setPlaying(false)); 
  }, []);

  
  useEffect(() => {
    const handleOffline = () => setNetworkState('offline');
    const handleOnline = () => {
      setNetworkState('good');
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
      if (hlsRef.current) hlsRef.current.startLoad();
      if (videoRef.current && !playing) attemptPlay();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [playing, attemptPlay]);

  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showNextCountdown && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (showNextCountdown && countdown === 0) {
      setShowNextCountdown(false);
      onPlayNext?.();
    }
    return () => clearTimeout(timer);
  }, [showNextCountdown, countdown, onPlayNext]);

  
  useEffect(() => {
    if (subtitles.length === 0 || activeSubtitle === -1) return;
    
    const convertActiveSubtitle = async () => {
      const sub = subtitles[activeSubtitle];
      if (sub && sub.url && !convertedSubUrls[activeSubtitle]) {
        setIsConvertingSubs(true);
        try {
          const vttUrl = await convertSrtUrlToVttBlob(sub.url);
          if (vttUrl !== sub.url) {
            setConvertedSubUrls(prev => ({ ...prev, [activeSubtitle]: vttUrl }));
            console.log('[VideoPlayer] Converted subtitle', activeSubtitle, 'to VTT blob');
          }
        } catch (e) {
          console.warn('[VideoPlayer] Failed to convert subtitle', activeSubtitle);
        }
        setIsConvertingSubs(false);
      }
    };
    
    convertActiveSubtitle();
  }, [subtitles, activeSubtitle, convertedSubUrls]);

  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (minimized || locked) return;
      
      switch(e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          skip(10);
          break;
        case 'ArrowLeft':
          skip(-10);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'ArrowUp':
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          adjustVolume(-0.1);
          break;
        case 'Escape':
          if (showSeasonSelector) setShowSeasonSelector(false);
          else if (showSettings) setShowSettings(false);
          else if (showSourceSelect) setShowSourceSelect(false);
          else onClose();
          break;
      }
    };
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [playing, minimized, locked, showSettings, showSourceSelect, showSeasonSelector]);

  
  useEffect(() => {
    if (subtitles.length > 0 && activeSubtitle === -1) {
      const bestSubtitle = findBestSubtitle(subtitles);
      if (bestSubtitle >= 0) {
        setActiveSubtitle(bestSubtitle);
      }
    }
  }, [subtitles]);

  
  const toggleFullscreen = useCallback(() => {
    if (locked) return;
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [locked]);

  
  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (video && video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  }, []);

  
  const loadSource = useCallback((source: VideoSource, sourceIndex: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsBuffering(true);
    setVideoError(null);
    setActiveSourceIndex(sourceIndex);
    
    
    if (source.quality) {
      setPreferredQuality(String(source.quality));
      localStorage.setItem('slflix_preferred_quality', String(source.quality));
    }
    
    
    if (hlsRef.current) { 
      hlsRef.current.destroy(); 
      hlsRef.current = null; 
    }
    
    const url = source.stream || source.direct || source.download;
    if (!url) return;

    const isHlsStream = source.type === 'hls' || url.includes('.m3u8');
    
    if (Hls.isSupported() && isHlsStream) {
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        startLevel: -1, 
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 10,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
      });
      
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
        video.playbackRate = playbackSpeed;
        attemptPlay();
        
        
        if (subtitles.length > 0) {
          
        }
      });
      
      hls.on(Hls.Events.FRAG_LOADED, () => {
        setIsBuffering(false);
        updateBuffered();
      });
      
      hls.on(Hls.Events.ERROR, (_, data) => { 
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (navigator.onLine) {
            setNetworkState('unstable');
            setTimeout(() => setNetworkState(prev => prev === 'unstable' ? 'good' : prev), 5000);
          }
        }
        if (data.fatal) {
          console.error('[HLS Error]', data.type, data.details);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      
      
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        console.log('[HLS] Quality switched to level:', data.level);
      });
    } else {
      
      video.src = url;
      
      
      video.onloadstart = () => {
        console.log('[Video] Load started');
        setIsBuffering(true);
      };
      
      video.oncanplay = () => { 
        console.log('[Video] Can play');
        setIsBuffering(false); 
        attemptPlay(); 
      };
      
      video.onplaying = () => {
        console.log('[Video] Playing');
        setIsBuffering(false);
        setPlaying(true);
      };
      
      video.onwaiting = () => {
        console.log('[Video] Waiting for data');
        setIsBuffering(true);
      };
      
      video.onerror = (e) => {
        console.error('[Video] Error:', video.error ? { code: video.error.code, message: video.error.message } : 'Unknown error');
        setVideoError('Failed to load video. Please try another source.');
        setIsBuffering(false);
      };
      
      if (initialTime > 0) video.currentTime = initialTime;
      video.playbackRate = playbackSpeed;
      video.onprogress = () => updateBuffered();
    }
  }, [initialTime, playbackSpeed, subtitles, attemptPlay, updateBuffered]);

  
  useEffect(() => { 
    if (sources.length > 0) {
      
      let targetIndex = 0;
      if (preferredQuality && preferredQuality !== 'Auto') {
        const index = sources.findIndex(s => String(s.quality) === preferredQuality);
        if (index !== -1) {
          targetIndex = index;
        }
      }
      loadSource(sources[targetIndex], targetIndex); 
    }
    return () => { 
      if (hlsRef.current) { 
        hlsRef.current.destroy(); 
        hlsRef.current = null; 
      } 
    }; 
  }, [sources]);

  
  useEffect(() => { 
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed; 
  }, [playbackSpeed]);

  
  useEffect(() => { 
    if (videoRef.current) { 
      videoRef.current.volume = volume; 
      videoRef.current.muted = isMuted; 
    } 
  }, [volume, isMuted]);

  
  const handleSubtitleChange = useCallback((index: number) => {
    setActiveSubtitle(index);
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = (i === index) ? 'showing' : 'hidden';
      }
    }
  }, []);

  
  useEffect(() => {
    const video = videoRef.current;
    if (!video || subtitles.length === 0) return;

    const initSubtitles = () => {
      console.log('[VideoPlayer] Initializing subtitles, count:', subtitles.length);
      
      
      if (activeSubtitle >= 0 && video.textTracks.length > activeSubtitle) {
        console.log('[VideoPlayer] Setting track', activeSubtitle, 'to showing');
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = (i === activeSubtitle) ? 'showing' : 'hidden';
        }
      } else {
         for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = 'hidden';
         }
      }
    };

    
    if (video.readyState >= 1) {
      
      setTimeout(initSubtitles, 500);
    } else {
      video.addEventListener('loadedmetadata', () => {
        setTimeout(initSubtitles, 500);
      }, { once: true });
    }

    
    initSubtitles();
  }, [subtitles, activeSubtitle]);

  
  const handleMouseMove = useCallback(() => {
    if (minimized) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!locked && playing) {
      controlsTimeoutRef.current = setTimeout(() => { 
        if (!showSettings && !showSourceSelect && !showSeasonSelector) setShowControls(false); 
      }, 3000);
    }
  }, [minimized, locked, playing, showSettings, showSourceSelect, showSeasonSelector]);

  
  const togglePlay = useCallback(() => { 
    if (locked) return; 
    if (videoRef.current) {
      const isPaused = videoRef.current.paused;
      isPaused ? attemptPlay() : videoRef.current.pause(); 
      triggerVisualFeedback(isPaused ? 'play' : 'pause');
    }
  }, [locked, attemptPlay, triggerVisualFeedback]);
  
  const skip = useCallback((seconds: number) => { 
    if (videoRef.current && !locked && !isBuffering && !isLive) {
      const newTime = videoRef.current.currentTime + seconds;
      videoRef.current.currentTime = Math.max(0, Math.min(newTime, duration || Infinity));
      triggerVisualFeedback(seconds > 0 ? 'forward' : 'backward', `${seconds > 0 ? '+' : ''}${seconds}s`);
    } 
  }, [locked, isBuffering, isLive, duration, triggerVisualFeedback]);
  
  const cycleSpeed = useCallback(() => { 
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  }, [playbackSpeed]);
  
  const handleDownload = useCallback((source: VideoSource) => { 
    const link = source.download || source.direct || source.stream; 
    if (link) window.open(link, '_blank'); 
  }, []);
  
  const toggleMute = useCallback(() => setIsMuted(!isMuted), [isMuted]);
  
  const adjustVolume = useCallback((delta: number) => {
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    if (newVol > 0 && isMuted) setIsMuted(false);
  }, [volume, isMuted]);
  
  
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration || locked) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    if (videoRef.current) videoRef.current.currentTime = newTime;
  }, [duration, locked]);

  
  const handleSeasonChange = useCallback((season: number) => {
    onSeasonChange?.(season);
  }, [onSeasonChange]);

  const handleEpisodeSelect = useCallback((season: number, episode: number) => {
    onEpisodeChange?.(season, episode);
    setShowSeasonSelector(false);
  }, [onEpisodeChange]);

  
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  
  const isSeries = movie?.type?.includes('Series') || movie?.type?.includes('TV') || (movie?.seasons && movie.seasons.length > 0);

  return (
    <div 
      ref={containerRef} 
      className={minimized 
        ? "fixed bottom-4 right-4 w-[320px] aspect-video z-[2000] bg-black shadow-2xl rounded-xl overflow-hidden cursor-pointer" 
        : `fixed inset-0 z-[2000] bg-black group overflow-hidden ${!showControls && !locked && !showSettings && !showSourceSelect && !showSeasonSelector && playing ? 'cursor-none' : ''}`
      } 
      onMouseMove={handleMouseMove} 
      onMouseLeave={() => playing && !showSettings && !showSourceSelect && !showSeasonSelector && setShowControls(false)} 
      onClick={minimized ? onToggleMinimize : undefined} 
      onDoubleClick={toggleFullscreen}
    >
      <video 
        ref={videoRef} 
        preload="auto" 
        className={`w-full h-full bg-black ${resizeMode === 'cover' ? 'object-cover' : 'object-contain'}`} 
        playsInline 
        
        onTimeUpdate={(e) => { 
          setCurrentTime(e.currentTarget.currentTime); 
          updateBuffered(); 
          if (onProgressUpdate && duration > 0) onProgressUpdate(e.currentTarget.currentTime, duration); 
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => { setIsBuffering(false); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onEnded={() => { 
          if (nextEpisode && onPlayNext) {
            setShowNextCountdown(true);
            setCountdown(5);
          } else {
            onClose(); 
          }
        }}
        onProgress={() => updateBuffered()}
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          console.error('[Video] Error:', target.error ? { code: target.error.code, message: target.error.message } : 'Unknown error');
          setVideoError('Failed to load video. Please try another source.');
          setIsBuffering(false);
        }}
      >
        {}
      </video>

      {}
      {isBuffering && networkState !== 'offline' && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
          <FastStreamLoader buffered={bufferedPercent / 100} />
        </div>
      )}

      {jumpIndicator && jumpIndicator.visible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100] animate-fade-in">
          <div className="flex flex-col items-center justify-center gap-2 bg-black/75 backdrop-blur-md border border-primary/30 w-24 h-24 md:w-28 md:h-28 rounded-full shadow-[0_0_25px_rgba(0,229,255,0.4)] transform scale-100 animate-[bounce_1s_infinite] select-none">
            {jumpIndicator.type === 'forward' && (
              <i className="fa-solid fa-forward text-2xl md:text-3xl text-primary animate-pulse"></i>
            )}
            {jumpIndicator.type === 'backward' && (
              <i className="fa-solid fa-backward text-2xl md:text-3xl text-primary animate-pulse"></i>
            )}
            {jumpIndicator.type === 'play' && (
              <i className="fa-solid fa-play text-2xl md:text-3xl text-primary animate-pulse pl-1"></i>
            )}
            {jumpIndicator.type === 'pause' && (
              <i className="fa-solid fa-pause text-2xl md:text-3xl text-primary animate-pulse"></i>
            )}
            {jumpIndicator.text && (
              <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">{jumpIndicator.text}</span>
            )}
          </div>
        </div>
      )}



      {}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
          <div className="text-center p-4">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <p className="text-white">{videoError}</p>
            <button 
              onClick={() => setVideoError(null)}
              className="mt-4 px-4 py-2 bg-primary text-black rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {}
      {showSourceSelect && (
        <div 
          className="absolute inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" 
          onClick={() => setShowSourceSelect(false)}
        >
          <div 
            className="bg-[#1a1a2e] rounded-xl p-4 w-full max-w-sm" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Select Quality</h3>
              <button 
                onClick={() => setShowSourceSelect(false)} 
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="space-y-2">
              {sources.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <button 
                    onClick={() => { loadSource(s, i); setShowSourceSelect(false); }} 
                    className={`flex-1 p-3 rounded-lg text-left flex justify-between ${activeSourceIndex === i ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}
                  >
                    <span className="font-bold">{s.label || s.quality + 'p'}</span>
                    {s.type === 'hls' && <span className="text-xs opacity-70">HLS</span>}
                  </button>
                  <button 
                    onClick={() => handleDownload(s)} 
                    className="p-3 bg-white/10 hover:bg-green-500/30 text-white rounded-lg"
                  >
                    <i className="fa-solid fa-download"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {}
      {showSettings && (
        <div 
          className="absolute inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" 
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-[#1a1a2e] rounded-xl p-4 w-full max-w-md max-h-[80vh] overflow-y-auto" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Settings</h3>
              <button 
                onClick={() => setShowSettings(false)} 
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            {}
            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-2">
                <i className="fa-solid fa-closed-captioning"></i> Subtitles
              </p>
              <div className="flex flex-wrap gap-2">
                {subtitles.length > 0 ? (
                  <SubtitleManager
                    videoElement={videoRef.current}
                    subtitles={subtitles.map((sub, i) => ({ ...sub, url: convertedSubUrls[i] || '' }))}
                    onSubtitleChange={handleSubtitleChange}
                    activeSubtitle={activeSubtitle}
                  />
                ) : (
                  <span className="text-white/50 text-xs">No subtitles available</span>
                )}
              </div>
            </div>

            {movie?.dubs && movie.dubs.length > 1 && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-microphone"></i> Audio / Dubs
                </p>
                <div className="flex gap-2 flex-wrap max-h-36 overflow-y-auto scrollbar-hide">
                  {movie.dubs.map((dub, i) => {
                    const isSelected = dub.subjectId === movie.subjectId || dub.detailPath === movie.detailPath;
                    return (
                      <button 
                        key={i} 
                        onClick={() => {
                          if (onDubSelect) {
                            onDubSelect(dub);
                            setShowSettings(false);
                          }
                        }} 
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${isSelected ? 'bg-primary border-primary text-black' : 'bg-white/10 text-white border-white/5 hover:bg-white/20'}`}
                      >
                        {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                        {dub.lanName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {}
            {isSeries && movie && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-layer-group"></i> Episodes
                </p>
                <SeasonSelector
                  movie={movie}
                  currentSeason={currentSeason}
                  currentEpisode={currentEpisode}
                  onSeasonChange={handleSeasonChange}
                  onEpisodeSelect={handleEpisodeSelect}
                />
              </div>
            )}

            {}
            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-2">
                <i className="fa-solid fa-gauge"></i> Speed
              </p>
              <div className="flex gap-2 flex-wrap">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setPlaybackSpeed(s)} 
                    className={`px-4 py-1.5 rounded text-xs ${playbackSpeed === s ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {}
            <div>
              <p className="text-gray-400 text-xs uppercase mb-2 flex items-center gap-2">
                <i className="fa-solid fa-expand"></i> Screen
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setResizeMode('contain')} 
                  className={`px-4 py-1.5 rounded text-xs ${resizeMode === 'contain' ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}
                >
                  Fit
                </button>
                <button 
                  onClick={() => setResizeMode('cover')} 
                  className={`px-4 py-1.5 rounded text-xs ${resizeMode === 'cover' ? 'bg-primary text-black' : 'bg-white/10 text-white'}`}
                >
                  Zoom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/85 transition-opacity flex flex-col justify-between ${showControls && !locked && !showSettings && !showSourceSelect ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {}
        <div className="p-4 md:p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors bg-black/40 backdrop-blur-sm"
              title="Go Back"
            >
              <i className="fa-solid fa-arrow-left text-lg"></i>
            </button>
            <div className="flex flex-col drop-shadow-md">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] uppercase font-black px-2 py-0.5 rounded tracking-widest bg-black/20 backdrop-blur-sm">
                  SL-FLIX Premium
                </span>
                {isLive && (
                  <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span> LIVE
                  </span>
                )}
              </div>
              <h2 className="text-white font-black text-sm md:text-xl tracking-tight select-all truncate sm:max-w-md md:max-w-2xl max-w-[180px]" title={title}>
                {title}
              </h2>
              {subTitle && <p className="text-gray-300 text-xs mt-0.5 font-medium">{subTitle}</p>}
            </div>
          </div>
          
          <div className="flex gap-2">
            {}
            <button 
              onClick={() => {
                const url = window.location.href;
                const text = `Check out ${title} on SL-FLIX! Watch free HD online: ${url}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-[#25D366] rounded-full bg-white/10 transition-colors"
              title="Share on WhatsApp"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
            </button>
            
            {}
            {isSeries && movie && (
              <>
                <VideoPlayerBulkModalWrapper movieId={movie.subjectId || movie.detailPath || ''} seasonNumber={currentSeason} />
                <button 
                  onClick={() => setShowSettings(true)} 
                  className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full bg-white/10"
                  title="Episodes"
                >
                  <i className="fa-solid fa-list-ul"></i>
                </button>
              </>
            )}
            <button 
              onClick={() => setShowSourceSelect(true)} 
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full bg-white/10"
              title="Quality"
            >
              <i className="fa-solid fa-list"></i>
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className={`w-9 h-9 flex items-center justify-center rounded-full ${showSettings ? 'bg-primary text-black' : 'text-white hover:bg-white/10'}`}
              title="Settings"
            >
              <i className="fa-solid fa-gear"></i>
            </button>
          </div>
        </div>
        
        {}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${playing && !isBuffering ? 'opacity-0' : 'opacity-100'}`}>
          <button 
            onClick={togglePlay} 
            className="pointer-events-auto w-14 h-14 md:w-20 md:h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:scale-110 transition-all animate-pulse"
          >
            <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-2xl md:text-3xl ml-1`}></i>
          </button>
        </div>
        
        {}
        {!minimized && (
          <div className="p-4 space-y-3">
            {}
            {!isLive && (
              <div 
                ref={progressRef} 
                onClick={handleProgressClick} 
                className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group"
              >
                {}
                <div 
                  className="absolute h-full bg-white/40 rounded-full transition-all" 
                  style={{ width: `${bufferedPercent}%` }}
                />
                {}
                <div 
                  className="absolute h-full bg-white rounded-full transition-all" 
                  style={{ width: `${playedPercent}%` }}
                />
                {}
                {isBuffering && (
                  <div 
                    className="absolute h-full bg-primary animate-pulse rounded-full" 
                    style={{ width: `${Math.min(bufferedPercent - playedPercent, 20)}%` }}
                  />
                )}
              </div>
            )}
            
            {}
            <div className="flex justify-between items-center text-white text-xs">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay}>
                  <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`}></i>
                </button>
                {!isLive && (
                  <>
                    <button onClick={() => skip(-10)}><i className="fa-solid fa-rotate-left"></i></button>
                    <button onClick={() => skip(10)}><i className="fa-solid fa-rotate-right"></i></button>
                    <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </>
                )}
                {isLive && <span className="text-red-500 font-bold">LIVE</span>}
              </div>
              
              <div className="flex items-center gap-3">
                {}
                <div className="relative flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="hover:text-primary">
                    <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : volume > 0.5 ? 'fa-volume-high' : 'fa-volume-low'}`}></i>
                  </button>
                  <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      value={isMuted ? 0 : volume}
                      onChange={(e) => { setVolume(parseFloat(e.target.value)); if (isMuted) setIsMuted(false); }}
                      className="w-16 h-1 accent-primary cursor-pointer"
                    />
                  </div>
                </div>
                
                {}
                <button 
                  onClick={cycleSpeed} 
                  className="font-bold hover:text-primary"
                >
                  {playbackSpeed}x
                </button>
                
                {}
                <button onClick={toggleFullscreen} className="hover:text-primary">
                  <i className="fa-solid fa-expand"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {}
      {networkState === 'unstable' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-black/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in-down">
          <i className="fa-solid fa-wifi text-yellow-500"></i> Network Unstable
        </div>
      )}
      
      {networkState === 'offline' && isBuffering && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center animate-fade-in">
          <i className="fa-solid fa-wifi text-red-500 text-6xl mb-4 animate-pulse"></i>
          <h2 className="text-white text-xl font-bold mb-2">Network Disconnected</h2>
          <p className="text-gray-400 text-sm">Please check your internet connection.</p>
        </div>
      )}
      
      {showReconnected && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-emerald-500/90 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in-down">
          <i className="fa-solid fa-check-circle"></i> Connected. Resuming playback...
        </div>
      )}

      {}
      {showNextCountdown && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center animate-fade-in">
          <h2 className="text-white text-2xl font-bold mb-4">Next Episode</h2>
          <div className="relative w-24 h-24 flex items-center justify-center mb-6">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="45" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
              <circle 
                cx="48" cy="48" r="45" 
                stroke="#00E5FF" 
                strokeWidth="6" 
                fill="none" 
                strokeDasharray="283" 
                strokeDashoffset={283 - (283 * countdown) / 5} 
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="text-white text-3xl font-bold">{countdown}</span>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setShowNextCountdown(false);
                onPlayNext?.();
              }}
              className="bg-primary text-black px-6 py-2 rounded-full font-bold hover:bg-primary/80 transition-colors"
            >
              Play Now
            </button>
            <button 
              onClick={() => {
                setShowNextCountdown(false);
                onClose();
              }}
              className="bg-white/20 text-white px-6 py-2 rounded-full font-bold hover:bg-white/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {}
      {locked && (
        <div className="absolute inset-0 z-[90] bg-black/80 flex items-center justify-center">
          <button 
            onClick={() => setLocked(false)} 
            className="w-14 h-14 bg-white/10 rounded-full text-white"
          >
            <i className="fa-solid fa-lock"></i>
          </button>
        </div>
      )}
      
      {}
      <div className="absolute bottom-16 md:bottom-20 left-4 z-40 pointer-events-none select-none">
        <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded opacity-60 hover:opacity-80 transition-opacity">
          <span className="text-primary text-xs font-bold tracking-wider uppercase">
            NETFLIX
          </span>
        </div>
      </div>
    </div>
  );
};


const VideoPlayer = (props: VideoPlayerProps) => {
  if (props.isTrailer) {
    return <TrailerPlayer 
      title={props.title} 
      sources={props.sources} 
      onClose={props.onClose} 
      coverImage={props.sources?.[0]?.stream} 
    />;
  }
  return <StreamingPlayer {...props} />;
};

export default VideoPlayer;

