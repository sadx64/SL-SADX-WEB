import { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { CategoryData, MovieResult } from '../types';

interface HomeData {
  categories: CategoryData[];
  hero: MovieResult[];
}

export const useHomeData = () => {
  const [data, setData] = useState<HomeData>({ categories: [], hero: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    const loadHomeData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        
        const homeDataPromise = ApiService.getHomeData();
        
        
        
        homeDataPromise.then(result => {
          if (mountedRef.current) {
            setData(result);
            setLoading(false);
          }
        }).catch(err => {
          if (mountedRef.current) {
            console.error('Home data loading failed:', err);
            setError('Failed to load home data');
            setLoading(false);
          }
        });

        
        const cachedData = await ApiService.getHomeData();
        if (mountedRef.current && (cachedData.categories.length > 0 || cachedData.hero.length > 0)) {
          setData(cachedData);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error('Home data initialization failed:', err);
          setError('Failed to initialize home data');
          setLoading(false);
        }
      }
    };

    loadHomeData();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  
  useEffect(() => {
    const prefetchTrending = () => {
      ApiService.getTrending(0, 18).catch(() => {
        
      });
    };
    
    
    if (!loading) {
      const timer = setTimeout(prefetchTrending, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return { data, loading, error };
};
