"use client";

export function SuggestedQuestions({ disabled, onSelect, questions }) {
  return (
    <div className="mt-6 grid w-full grid-cols-1 gap-2 md:mt-8 md:gap-3 sm:grid-cols-2">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-xs text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:py-3 md:text-sm"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
