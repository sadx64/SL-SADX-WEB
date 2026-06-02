export interface MovieResult {
  title: string;
  cover: string;
  thumbnail: string;
  type: string; 
  subjectId: string;
  imdbRating?: string;
  releaseDate?: string;
  genre?: string;
  description?: string;
  countryName?: string;
  detailPath?: string;
  hasResource?: boolean;

  
  cast?: CastMember[];
  recommendations?: MovieResult[];
  seasons?: Season[];
  trailerUrl?: string;
  sourceUrl?: string; 
  rawStartTime?: number; 
  dubs?: MovieDub[];
}

export interface MovieDub {
  subjectId: string;
  lanName: string;
  lanCode: string;
  detailPath: string;
  original: boolean;
}

export interface CastMember {
  name: string;
  character?: string;
  avatar: string;
  id?: string;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
  episodes?: Episode[];
}

export interface Episode {
  episodeNumber: number;
  title?: string;
}

export interface SearchResponse {
  results: MovieResult[];
}

export interface Subtitle {
  lang?: string;
  language?: string;
  name: string;
  url: string;
  label?: string;
}

export interface VideoSource {
  id?: string;
  quality: number; 
  size?: string;
  download?: string;
  direct?: string;
  stream?: string;
  label?: string; 
  type?: 'hls' | 'mp4' | 'dash';
}

export interface CategoryData {
  title: string;
  query: string;
  movies: MovieResult[];
  isLive?: boolean;
}

export interface ImdbSuggestion {
  id: string;
  l: string;
  s?: string;
  y?: number;
  i?: { imageUrl: string; height: number; width: number };
  q?: string;
  v?: { id: string; l: string; s: string }[];
  rank?: number;
}
