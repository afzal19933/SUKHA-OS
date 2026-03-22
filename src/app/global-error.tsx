"use client";

/**
 * Root Error Boundary for Next.js.
 * Handles errors that occur within the root layout.
 * Must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#f1f5f9',
          fontFamily: 'sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '450px',
            backgroundColor: 'white',
            padding: '50px',
            borderRadius: '32px',
            boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#ef4444',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 30px',
              color: 'white',
              boxShadow: '0 10px 20px rgba(239, 68, 68, 0.3)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            
            <h1 style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: '#0f172a', letterSpacing: '-0.02em' }}>Critical Fault</h1>
            <p style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '30px', letterSpacing: '0.3em' }}>
              Root System Recovery Required
            </p>

            <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569', marginBottom: '40px' }}>
              A fatal error occurred in the core system layer. The platform has intercepted this exception to prevent instability.
            </p>

            <button 
              onClick={() => reset()}
              style={{
                width: '100%',
                height: '56px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 900,
                textTransform: 'uppercase',
                fontSize: '12px',
                letterSpacing: '0.2em',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Reinitialize SUKHA OS
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
