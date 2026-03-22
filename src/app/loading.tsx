/**
 * Global Loading state for the SUKHA OS application.
 * Satisfies platform structure requirements and provides visual feedback.
 */
export default function RootLoading() {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#5F5FA7',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(95, 95, 167, 0.3)',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          <span style={{ color: 'white', fontSize: '32px', fontWeight: 900 }}>S</span>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: '14px', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            color: '#5F5FA7', 
            letterSpacing: '0.1em',
            margin: 0 
          }}>
            Initializing SUKHA OS
          </h2>
          <div style={{
            width: '120px',
            height: '2px',
            backgroundColor: '#e2e8f0',
            borderRadius: '1px',
            marginTop: '12px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              height: '100%',
              width: '40%',
              backgroundColor: '#5F5FA7',
              animation: 'loading 1.5s infinite ease-in-out'
            }} />
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .7; }
        }
      `}} />
    </div>
  );
}
