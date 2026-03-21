
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeGreetingProps {
  userName?: string | null;
}

/**
 * WelcomeGreeting Component
 * Production-grade voice greeting system with Gatekeeper Pattern.
 */
export function WelcomeGreeting({ userName }: WelcomeGreetingProps) {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'visible' | 'exiting'>('hidden');
  const nameToUse = userName || "User";
  
  const hasGreetedRef = useRef(false);
  const gatekeeperTriggeredRef = useRef(false);
  const isActiveRef = useRef(true);
  const isExitingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isActiveRef.current = true;
    
    const sessionKey = `greeted_${nameToUse}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return;
    }
    
    if (hasGreetedRef.current) return;

    const initGreeting = async () => {
      setStatus('loading');
      
      try {
        const response = await fetch(`/api/tts-greeting?name=${encodeURIComponent(nameToUse)}`);
        
        if (!response.ok || response.status === 204) {
          triggerFallback();
          return;
        }
        
        const blob = await response.blob();
        if (!isActiveRef.current) return;
        
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        
        const audio = new Audio();
        audioRef.current = audio;
        
        const triggerGatekeeper = () => {
          if (gatekeeperTriggeredRef.current || !isActiveRef.current) return;
          gatekeeperTriggeredRef.current = true;
          
          if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
          
          setTimeout(() => {
            if (!isActiveRef.current) return;
            setStatus('visible');
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => console.warn("Autoplay restriction", err));
            }
            
            maxDurationTimerRef.current = setTimeout(dismiss, 3000);
          }, 100);
        };

        const dismiss = () => {
          if (isExitingRef.current || !isActiveRef.current) return;
          isExitingRef.current = true;
          if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
          
          setStatus('exiting');
          exitTimerRef.current = setTimeout(() => {
            if (isActiveRef.current) {
              setStatus('hidden');
              sessionStorage.setItem(sessionKey, 'true');
              hasGreetedRef.current = true;
            }
          }, 300);
        };

        audio.oncanplaythrough = triggerGatekeeper;
        audio.onended = dismiss;
        audio.onerror = () => { if (isActiveRef.current) triggerGatekeeper(); };

        audio.src = url;
        audio.load();

        watchdogTimerRef.current = setTimeout(triggerGatekeeper, 1500);

      } catch (err) {
        triggerFallback();
      }
    };

    const triggerFallback = () => {
      if (!isActiveRef.current) return;
      setStatus('visible');
      maxDurationTimerRef.current = setTimeout(() => {
        setStatus('exiting');
        exitTimerRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            setStatus('hidden');
            sessionStorage.setItem(sessionKey, 'true');
            hasGreetedRef.current = true;
          }
        }, 300);
      }, 3000);
    };

    initGreeting();

    return () => {
      isActiveRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [nameToUse]);

  if (status === 'hidden') return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[999] flex items-center justify-center transition-all duration-500",
      (status === 'visible' || status === 'loading') ? "opacity-100 backdrop-blur-xl bg-black/30" : "opacity-0 backdrop-blur-0 bg-transparent pointer-events-none"
    )}>
      <div className={cn(
        "bg-white p-12 rounded-[3.5rem] shadow-2xl border border-primary/10 transition-all duration-500 transform",
        status === 'visible' ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"
      )}>
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="bg-primary h-16 w-16 rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-primary/40 mb-2 animate-pulse">
            <span className="text-white font-black text-3xl">S</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-[11px] font-black text-primary uppercase tracking-[0.4em]">SUKHA OS</h2>
            <p className="text-4xl font-black text-slate-900 tracking-tight">Welcome {nameToUse}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
