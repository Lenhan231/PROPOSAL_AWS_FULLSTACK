import { motion } from 'framer-motion';

export function BookCardSkeleton() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 animate-pulse">
      <div className="h-48 mb-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-lg animate-shimmer"></div>
      <div className="h-4 mb-2 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 mb-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-3 mb-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-5 mb-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-3 mb-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        </div>
        <div className="flex gap-2">
          <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-3 mb-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        </div>
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="px-4 py-12 mx-auto max-w-7xl">
      <div className="mb-8 animate-pulse">
        <div className="h-10 mb-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <BookCardSkeleton />
        <BookCardSkeleton />
        <BookCardSkeleton />
      </div>
    </div>
  );
}

// Add shimmer animation to global CSS
export const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
    background-size: 1000px 100%;
  }
`;
