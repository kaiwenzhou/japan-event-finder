"use client";

interface LanguageToggleProps {
  showJapanese: boolean;
  onToggle: (value: boolean) => void;
}

export default function LanguageToggle({ showJapanese, onToggle }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${!showJapanese ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
        EN
      </span>
      <button
        onClick={() => onToggle(!showJapanese)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          showJapanese ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            showJapanese ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-sm ${showJapanese ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
        日本語
      </span>
    </div>
  );
}
