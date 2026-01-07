"use client";

import { Event } from "@/lib/db";

interface EventCardProps {
  event: Event;
  showJapanese: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Free / TBD";
  if (min === max) return `¥${min?.toLocaleString()}`;
  if (min === null) return `Up to ¥${max?.toLocaleString()}`;
  if (max === null) return `From ¥${min?.toLocaleString()}`;
  return `¥${min?.toLocaleString()} - ¥${max?.toLocaleString()}`;
}

const categoryColors: Record<string, string> = {
  kabuki: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  orchestra: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  anime: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  rakugo: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  musical: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  festival: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  art: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function EventCard({ event, showJapanese }: EventCardProps) {
  const title = showJapanese ? event.title_ja : (event.title_en || event.title_ja);
  const description = showJapanese
    ? event.description_ja
    : (event.description_en || event.description_ja);
  const categoryColor = categoryColors[event.category] || categoryColors.default;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs px-2 py-1 rounded-full ${categoryColor}`}>
          {event.category}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {event.source_name}
        </span>
      </div>

      <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">
        {title}
      </h3>

      {showJapanese && event.title_en && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {event.title_en}
        </p>
      )}

      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
          {description}
        </p>
      )}

      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {formatDate(event.date_start)}
            {event.date_end && event.date_end !== event.date_start && (
              <> - {formatDate(event.date_end)}</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{event.venue_name} ({event.area})</span>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatPrice(event.price_min, event.price_max)}</span>
        </div>
      </div>

      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {event.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <a
        href={event.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
      >
        View / Buy Tickets
      </a>
    </div>
  );
}
