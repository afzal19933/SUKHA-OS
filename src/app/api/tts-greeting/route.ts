import { NextRequest } from 'next/server';
import { generateGreetingAudio } from '@/ai/flows/greeting-tts-flow';

/**
 * TTS Greeting Endpoint
 * Fetches the WAV audio buffer for the welcome sequence.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userName = searchParams.get('userName') || 'User';

  try {
    const audioBuffer = await generateGreetingAudio({ userName });
    
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error("TTS API Error:", error);
    return new Response(null, { status: 500 });
  }
}
