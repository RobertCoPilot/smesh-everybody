'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ScoreInputProps {
  score: number;
  maxScore: number;
  disabled?: boolean;
  accentColor?: string;
  onScoreChange: (newScore: number) => void;
}

export default function ScoreInput({
  score, maxScore, disabled = false, accentColor = 'app-text-primary', onScoreChange,
}: ScoreInputProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitValue = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      onScoreChange(Math.max(0, Math.min(maxScore, parsed)));
    }
    setEditing(false);
  };

  if (disabled) {
    return (
      <div className="flex items-center justify-center">
        <span className={`text-xl font-bold tabular-nums w-10 text-center ${accentColor}`}>
          {score}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onScoreChange(Math.max(0, score - 1))}
        disabled={score <= 0}
        className="score-button w-8 h-8 flex items-center justify-center rounded-xl text-lg font-bold"
      >
        −
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={maxScore}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitValue();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="score-input w-12 h-8 text-center text-lg font-bold tabular-nums rounded-lg appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
      ) : (
        <button
          onClick={() => { setInputValue(String(score)); setEditing(true); }}
          className="score-display w-12 h-8 flex items-center justify-center rounded-lg cursor-text"
          title="Tippen zum Eingeben"
        >
          <span className="text-xl font-bold tabular-nums app-text-primary">
            {score}
          </span>
        </button>
      )}

      <button
        onClick={() => onScoreChange(Math.min(maxScore, score + 1))}
        disabled={score >= maxScore}
        className="score-button w-8 h-8 flex items-center justify-center rounded-xl text-lg font-bold"
      >
        +
      </button>
    </div>
  );
}
