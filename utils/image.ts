export const getOptimizedImageUrl = (url: string, width: number = 300) => {
    if (!url) return '';
    if (url.startsWith('/') || url.includes('wsrv.nl')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&w=${width}&q=80`;
};
