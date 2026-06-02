import React, { Suspense } from 'react';
import { CategoryData, MovieResult } from '../types';
import { ApiService } from '../services/api';
import MovieCard from './MovieCard';
import { ChevronRightIcon } from './Icons';
import { getOptimizedImageUrl } from '../utils/image';

const HeroSkeleton = () => (
  <div className="h-[50vh] md:h-[70vh] relative flex items-center bg-[#0a0a15]">
    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a15] via-[#0a0a15]/30 to-transparent"></div>
    <div className="relative z-10 px-[4%] w-full max-w-4xl mt-20">
      <div className="h-6 w-24 bg-white/10 rounded-full mb-4 animate-pulse"></div>
      <div className="h-12 md:h-16 w-4/5 bg-white/10 rounded-lg mb-4 animate-pulse"></div>
      <div className="h-6 w-3/5 bg-white/10 rounded-lg mb-6 animate-pulse"></div>
      <div className="h-12 w-40 bg-white/10 rounded-full animate-pulse"></div>
    </div>
  </div>
);

const CategorySkeleton = () => (
  <div className="my-8 px-[4%]">
    <div className="h-8 w-48 bg-white/10 rounded mb-4 animate-pulse"></div>
    <div className="flex gap-4 overflow-hidden">
      {[1, 2, 3, 4, 5, 6].map((j) => (
        <div key={j} className="flex-none w-[140px] md:w-[180px]">
          <div className="w-full aspect-[2/3] bg-white/10 rounded-lg animate-pulse"></div>
          <div className="h-4 w-3/4 mt-2 bg-white/10 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

const Hero: React.FC<{ movies: MovieResult[], onPlay: (m: MovieResult) => void }> = ({ movies, onPlay }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  
  React.useEffect(() => {
    if (movies.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => { setCurrentIndex((prev) => (prev + 1) % movies.length); setIsTransitioning(false); }, 500);
    }, 6000);
    return () => clearInterval(interval);
  }, [movies.length]);

  if (!movies.length) return <HeroSkeleton />;
  
  const m = movies[currentIndex];
  const goToSlide = (idx: number) => { if (idx === currentIndex) return; setIsTransitioning(true); setTimeout(() => { setCurrentIndex(idx); setIsTransitioning(false); }, 300); };

  return (
    <div className="h-[50vh] md:h-[70vh] relative flex items-center bg-black overflow-hidden group">
      <div className="absolute inset-0">
        {movies.map((movie, idx) => (<div key={idx} className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out ${idx === currentIndex ? 'opacity-60 scale-100' : 'opacity-0 scale-105'}`} style={{ backgroundImage: `url(${getOptimizedImageUrl(movie.cover, 1280)})` }} />))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a15] via-[#0a0a15]/30 to-transparent"></div>
      {movies.length > 1 && <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 flex gap-2">{movies.map((_, idx) => (<button key={idx} onClick={() => goToSlide(idx)} className={`h-2 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-primary w-10 shadow-[0_0_10px_rgba(0,229,255,0.5)]' : 'bg-white/30 w-2 hover:bg-white/50'}`} />))}</div>}
      <div className="relative z-10 px-[4%] w-full max-w-4xl mt-20">
        <span className="bg-primary text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block shadow-lg">Featured</span>
        <h1 className={`text-4xl md:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-xl transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>{m.title}</h1>
        <p className={`text-gray-200 line-clamp-2 text-sm md:text-lg mb-6 max-w-xl shadow-black drop-shadow-md transition-all duration-500 delay-100 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>{m.description || "Stream now in HD quality."}</p>
        <button onClick={() => onPlay(m)} className={`bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-primary hover:scale-105 transition-all duration-300 flex items-center gap-2 shadow-lg ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}><i className="fa-solid fa-play"></i> Watch Now</button>
      </div>
      {movies.length > 1 && (
        <>
          <button onClick={() => goToSlide((currentIndex - 1 + movies.length) % movies.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"><i className="fa-solid fa-chevron-left text-lg"></i></button>
          <button onClick={() => goToSlide((currentIndex + 1) % movies.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"><i className="fa-solid fa-chevron-right text-lg"></i></button>
        </>
      )}
    </div>
  );
};

const CategoryRow: React.FC<{ data: CategoryData, onMovieClick: (m: MovieResult) => void, onSeeMore?: () => void }> = ({ data, onMovieClick, onSeeMore }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  
  const [movies, setMovies] = React.useState(data.movies);
  const [page, setPage] = React.useState(1);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  React.useEffect(() => {
    setMovies(data.movies);
    setPage(1);
    setHasMore(true);
  }, [data.movies]);

  if (!movies || movies.length === 0) return <CategorySkeleton />;

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await ApiService.getRankingList(data.title, nextPage);
      if (res.results && res.results.length > 0) {
        const newMovies = res.results.filter((nm: any) => !movies.some(m => m.subjectId === nm.subjectId));
        if (newMovies.length > 0) {
          setMovies(prev => [...prev, ...newMovies]);
          setPage(nextPage);
          setHasMore(res.hasMore);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Failed to load more movies", e);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
      
      if (scrollLeft + clientWidth >= scrollWidth - 400 && !isLoadingMore && hasMore) {
        loadMore();
      }
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    if (isHovered || movies.length <= 4) return;
    
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
        }
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isHovered, movies.length]);

  const showAsGrid = movies.length > 8;

  if (showAsGrid) {
    return (
      <div className="my-8 px-[4%] animate-fade-in" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full"></span>
            {data.title}
            {data.isLive && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">Live</span>}
          </h2>
          {onSeeMore && <button onClick={onSeeMore} className="text-primary text-sm font-semibold hover:text-white transition-colors flex items-center gap-1">See more <ChevronRightIcon className="w-3 h-3" /></button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {movies.map((m, i) => (
            <div key={`${m.subjectId}-${i}`} className="transform transition-all duration-300 hover:scale-[1.03] hover:z-10 animate-fade-in">
              <MovieCard movie={m} onClick={onMovieClick} />
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button 
              onClick={loadMore} 
              disabled={isLoadingMore} 
              className="bg-primary/25 hover:bg-primary/40 border border-primary/50 text-primary px-6 py-2 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-primary-glow"
            >
              {isLoadingMore ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Loading</>
              ) : (
                <><i className="fa-solid fa-plus text-[10px]"></i> Show More</>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-8 px-[4%]" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2"><span className="w-1 h-5 bg-primary rounded-full"></span>{data.title}{data.isLive && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">Live</span>}</h2>
        {onSeeMore && movies.length >= 4 && <button onClick={onSeeMore} className="text-primary text-sm font-semibold hover:text-white transition-colors flex items-center gap-1">See more <ChevronRightIcon className="w-3 h-3" /></button>}
      </div>
      <div className="relative group">
        {showLeftArrow && movies.length > 4 && <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-[#0a0a15] to-transparent z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-chevron-left text-white"></i></button>}
        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
          {movies.map((m, i) => (
            <div key={`${m.subjectId}-${i}`} className="flex-none w-[140px] md:w-[180px]">
              <MovieCard movie={m} onClick={onMovieClick} />
            </div>
          ))}
          {isLoadingMore && (
            <div className="flex-none w-[140px] md:w-[180px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        {showRightArrow && movies.length > 4 && <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-[#0a0a15] to-transparent z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-chevron-right text-white"></i></button>}
      </div>
    </div>
  );
};

const HomePage: React.FC<{
  heroMovies: MovieResult[];
  categoriesData: CategoryData[];
  onMovieClick: (m: MovieResult) => void;
  onToplistClick: () => void;
  loading: boolean;
}> = ({ heroMovies, categoriesData, onMovieClick, onToplistClick, loading }) => {
  if (loading) {
    return (
      <div className="animate-fade-in">
        <HeroSkeleton />
        {[1, 2, 3, 4].map((i) => <CategorySkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="pb-24">
      <Suspense fallback={<HeroSkeleton />}>
        <Hero movies={heroMovies} onPlay={onMovieClick} />
      </Suspense>

      {categoriesData.map((cat, i) => (
        <Suspense key={i} fallback={<CategorySkeleton />}>
          <CategoryRow data={cat} onMovieClick={onMovieClick} onSeeMore={onToplistClick} />
        </Suspense>
      ))}
    </div>
  );
};

export default HomePage;
