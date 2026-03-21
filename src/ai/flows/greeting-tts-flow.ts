'use server';
/**
 * @fileOverview AI Flow for generating professional welcome greetings.
 * 
 * - generateGreetingAudio - Converts "Welcome [User Name]" into high-fidelity speech.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';

const GreetingInputSchema = z.object({
  userName: z.string().describe("The name of the user to greet.")
});

export type GreetingInput = z.infer<typeof GreetingInputSchema>;

/**
 * Converts PCM audio data to a browser-compatible WAV buffer.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs)));

    writer.write(pcmData);
    writer.end();
  });
}

export const generateGreetingAudio = ai.defineFlow(
  {
    name: 'generateGreetingAudio',
    inputSchema: GreetingInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    // Strictly follow "Welcome {{user_name}}" format as per requirements
    const greetingText = `Welcome ${input.userName || 'User'}`;

    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: greetingText,
    });

    if (!media || !media.url) {
      throw new Error('Failed to generate audio media.');
    }

    // Extract base64 PCM and convert to WAV
    const base64Data = media.url.split(',')[1];
    const pcmBuffer = Buffer.from(base64Data, 'base64');
    const wavBuffer = await toWav(pcmBuffer);

    return wavBuffer;
  }
);
