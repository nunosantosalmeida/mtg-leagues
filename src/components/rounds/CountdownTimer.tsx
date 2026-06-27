"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon, PauseIcon, RotateCcwIcon, ClockIcon, Minimize2Icon } from "lucide-react";

interface CountdownTimerProps {
  defaultMinutes: number;
  roundId: string;
  inline?: boolean;
}

function getStorageKey(roundId: string, field: string) {
  return `timer:${roundId}:${field}`;
}

export function CountdownTimer({ defaultMinutes, roundId, inline }: CountdownTimerProps) {
  const totalSeconds = defaultMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(roundId, "remaining"));
    if (stored !== null) setRemaining(Number(stored));
    const wasRunning = localStorage.getItem(getStorageKey(roundId, "running"));
    if (wasRunning === "true") setRunning(true);
  }, [roundId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(roundId, "remaining"), String(remaining));
  }, [remaining, roundId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(roundId, "running"), String(running));
  }, [running, roundId]);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expanded]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = remaining / totalSeconds;
  const isLow = remaining <= 300;
  const isCritical = remaining <= 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  function handleStart() {
    if (remaining > 0) setRunning(true);
  }

  function handlePause() {
    setRunning(false);
  }

  function handleReset() {
    setRunning(false);
    setRemaining(totalSeconds);
  }

  const timerColor = isCritical
    ? "text-red-500"
    : isLow
    ? "text-orange-500"
    : "text-foreground";

  const bgColor = isCritical
    ? "bg-red-500"
    : isLow
    ? "bg-orange-500"
    : "bg-foreground";

  if (inline) {
    return (
      <div className="flex items-center gap-3">
        <span className={`font-mono text-lg font-bold tabular-nums ${timerColor}`}>
          {timeStr}
        </span>
        <div className="flex items-center gap-1">
          {!running ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStart} disabled={remaining === 0}>
              <PlayIcon className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePause}>
              <PauseIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
            <RotateCcwIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold tabular-nums cursor-pointer transition-colors hover:opacity-80 ${
          isCritical
            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            : isLow
            ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
            : "bg-muted text-foreground"
        }`}
      >
        <ClockIcon className="h-3.5 w-3.5" />
        <span>{timeStr}</span>
      </button>

      {expanded && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
          <div className="absolute top-4 right-4">
            <Button variant="ghost" size="icon" onClick={() => setExpanded(false)}>
              <Minimize2Icon className="h-5 w-5" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-12 uppercase tracking-wider">Time Remaining</p>

          <div className={`text-[200px] sm:text-[280px] md:text-[360px] font-mono font-bold tabular-nums leading-none ${timerColor}`}>
            {timeStr}
          </div>

          <div className="w-80 h-2 bg-muted rounded-full overflow-hidden mt-12">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${bgColor}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4 mt-10">
            {!running ? (
              <Button variant="outline" size="lg" onClick={handleStart} disabled={remaining === 0} className="gap-2">
                <PlayIcon className="h-5 w-5" />
                Start
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={handlePause} className="gap-2">
                <PauseIcon className="h-5 w-5" />
                Pause
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={handleReset} className="gap-2">
              <RotateCcwIcon className="h-5 w-5" />
              Reset
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-12">Press Esc to collapse</p>
        </div>
      )}
    </>
  );
}
