import React from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { MovieResult } from '../types';
import { getOptimizedImageUrl } from '../utils/image';

interface MovieCardProps {
    movie: MovieResult;
    onClick: (m: MovieResult) => void;
    progress?: number; 
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, onClick, progress }) => {
    
    const getTypeColor = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('movie')) return 'bg-blue-600/90';
        if (t.includes('tv') || t.includes('series')) return 'bg-purple-600/90';
        if (t.includes('music')) return 'bg-pink-600/90';
        if (t.includes('adult') || t.includes('18')) return 'bg-red-600/90';
        return 'bg-gray-700/90';
    };

    
    const rating = movie.imdbRating && movie.imdbRating !== '0' && movie.imdbRating !== 'null' ? movie.imdbRating : null;
    const ratingNum = rating ? parseFloat(rating) : 0;
    const showRating = ratingNum > 0;

    return (
        <div 
            onClick={() => onClick(movie)}
            className="w-full cursor-pointer relative transition-transform duration-300 hover:scale-105 hover:z-10 group"
        >
            <div className="w-full aspect-[2/3] rounded-lg overflow-hidden border border-transparent transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] relative bg-card-bg">
                <LazyLoadImage 
                    src={getOptimizedImageUrl(movie.cover, 300)} 
                    alt={movie.title}
                    effect="blur"
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${movie.subjectId || Math.random()}/200/300`;
                    }}
                />
                
                {}
                <div className={`absolute top-1 right-1 ${getTypeColor(movie.type)} backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold text-white uppercase tracking-wider border border-white/10 shadow-sm z-10`}>
                    {movie.type || 'Unknown'}
                </div>

                {}
                {showRating && (
                    <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded border border-yellow-500/30">
                        <i className="fa-solid fa-star text-[10px] text-yellow-400"></i>
                        <span className="text-[10px] font-bold text-yellow-400">{ratingNum.toFixed(1)}</span>
                    </div>
                )}

                {}
                {progress !== undefined && progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 z-20">
                        <div 
                            className="h-full bg-primary shadow-[0_0_10px_rgba(0,229,255,0.8)]" 
                            style={{ width: `${Math.min(100, progress)}%` }}
                        ></div>
                    </div>
                )}
                
                {}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                    <div className="w-12 h-12 rounded-full bg-primary/90 text-black flex items-center justify-center transform scale-50 group-hover:scale-100 transition-transform duration-300">
                        <i className="fa-solid fa-play ml-1"></i>
                    </div>
                </div>
            </div>
            
            {}
            <div className="mt-2 px-1">
                 <h3 className="text-sm font-medium text-gray-200 line-clamp-1 group-hover:text-primary transition-colors">{movie.title}</h3>
                 <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[10px] text-gray-500">{movie.releaseDate ? movie.releaseDate.substring(0, 4) : ''}</span>
                 </div>
            </div>
        </div>
    );
};

export default MovieCard;
