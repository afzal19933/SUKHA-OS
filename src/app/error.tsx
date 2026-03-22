"use client";

import { useEffect } from "react";

/**
 * Standard Error Boundary for Next.js segments.
 * Uses minimal dependencies to ensure the boundary itself doesn't crash.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Runtime Error:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#f8fafc',
      fontFamily: 'sans-serif',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '400px',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        border: '1px solid #fee2e2'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#fef2f2',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#ef4444'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        
        <h2 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: '#0f172a' }}>System Interruption</h2>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '24px', letterSpacing: '0.05em' }}>
          An unexpected runtime exception was encountered.
        </p>

        <div style={{
          padding: '16px',
          backgroundColor: '#f1f5f9',
          borderRadius: '12px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#ef4444', wordBreak: 'break-all', margin: 0 }}>
            {error.message || "Unknown Application Error"}
          </p>
        </div>

        <button 
          onClick={() => reset()} 
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: '#5F5FA7',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 900,
            textTransform: 'uppercase',
            fontSize: '11px',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(95, 95, 167, 0.2)'
          }}
        >
          Attempt Recovery
        </button>
      </div>
    </div>
  );
}
