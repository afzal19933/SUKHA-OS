"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeGreetingProps {
  userName: string | null | undefined;
}

/**
 * WelcomeGreeting Component
 * Ultra-reliable voice greeting system with Gatekeeper Pattern sync.
 * 
 * Logic:
 * 1. Tracks identity to allow fresh greetings when switching accounts.
 * 2. Uses session storage per-user to prevent repetitive playback.
 * 3. Gates UI visibility until audio is fully preloaded.
 */
export function WelcomeGreeting({ userName }: WelcomeGreetingProps) {
  const [visibility, setVisibility] = useState<'hidden' | 'loading' | 'visible' | 'exiting'>('hidden');
  
  // Requirement: Fallback to "User" if name is missing
  const safeName = userName?.trim() || "User";
  // Identity-specific session key to allow different users to be greeted in the same browser session
  const sessionKey = `greeted_${safeName.replace(/\s+/g, '_')}`;

  // Safeguard Refs
  const isActiveRef = useRef(true);
  const greetedThisInstanceRef = useRef<string | null>(null);
  const gatekeeperTriggeredRef = useRef(false);
  const isExitingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  
  // Timeout Refs
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exitTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nameResolutionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = () => {
    if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    if (exitTransitionTimeoutRef.current) clearTimeout(exitTransitionTimeoutRef.current);
    if (nameResolutionTimeoutRef.current) clearTimeout(nameResolutionTimeoutRef.current);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const dismiss = () => {
    if (isExitingRef.current || !isActiveRef.current) return;
    isExitingRef.current = true;
    
    setVisibility('exiting');
    
    exitTransitionTimeoutRef.current = setTimeout(() => {
      if (isActiveRef.current) setVisibility('hidden');
    }, 300);
  };

  const startSequence = () => {
    if (gatekeeperTriggeredRef.current || !isActiveRef.current) return;
    gatekeeperTriggeredRef.current = true;

    if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);

    // Primary Sync Trigger
    setTimeout(() => {
      if (!isActiveRef.current) return;
      
      setVisibility('visible');
      
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently handle autoplay blocks
          });
        }
      }

      // Max Duration Watchdog (3s)
      maxDurationTimeoutRef.current = setTimeout(dismiss, 3000);
    }, 100);
  };

  const fetchAndPlay = async (targetName: string) => {
    try {
      const response = await fetch(`/api/tts-greeting?userName=${encodeURIComponent(targetName)}`);
      if (!response.ok) throw new Error("Audio fetch failed");
      
      const blob = await response.blob();
      if (!isActiveRef.current) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio();
      audioRef.current = audio;
      
      audio.oncanplaythrough = startSequence;
      audio.onerror = startSequence; // Fallback to silent UI if error
      audio.onended = dismiss; 
      
      audio.src = url;
      audio.load();

      // Watchdog Fallback (1000ms)
      watchdogTimeoutRef.current = setTimeout(startSequence, 1000);

    } catch (err) {
      if (isActiveRef.current) startSequence();
    }
  };

  useEffect(() => {
    isActiveRef.current = true;

    // Wait for real name if we are seeing the "User" fallback
    // Profile sync from Firestore usually takes < 300ms
    if (userName === null || userName === undefined) {
      setVisibility('hidden');
      return;
    }

    // Identity & Session Check
    if (sessionStorage.getItem(sessionKey) || greetedThisInstanceRef.current === safeName) {
      return;
    }

    // Reset instance state for new identity
    gatekeeperTriggeredRef.current = false;
    isExitingRef.current = false;
    greetedThisInstanceRef.current = safeName;
    sessionStorage.setItem(sessionKey, "true");
    
    setVisibility('loading');
    fetchAndPlay(safeName);

    return () => {
      isActiveRef.current = false;
      cleanup();
    };
  }, [userName, sessionKey, safeName]);

  if (visibility === 'hidden') return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 backdrop-blur-sm transition-opacity duration-300",
        visibility === 'loading' ? "opacity-0" : 
        visibility === 'exiting' ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={cn(
          "bg-white/90 backdrop-blur-md p-10 rounded-[3rem] shadow-2xl border border-white/20 transition-all duration-300 transform",
          visibility === 'visible' ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 animate-pulse">
            <span className="text-white font-black text-2xl">S</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tighter text-primary uppercase">
              Welcome {safeName}
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              SUKHA OS Operational Control
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
