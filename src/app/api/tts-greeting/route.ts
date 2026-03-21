
import { NextRequest } from 'next/server';
import { generateGreetingAudio } from '@/ai/flows/greeting-tts-flow';

/**
 * API Endpoint for TTS Greeting
 * Returns a WAV audio blob for the synchronized greeting system.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || 'User';
  
  try {
    const audioDataUri = await generateGreetingAudio({ greeting: "Welcome", userName: name });
    
    if (!audioDataUri) {
      return new Response(null, { status: 204 });
    }
    
    // Convert data URI back to binary buffer
    const base64Parts = audioDataUri.split(',');
    const base64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
    const buffer = Buffer.from(base64, 'base64');
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error("TTS API Error:", error);
    return new Response(null, { status: 500 });
  }
}
