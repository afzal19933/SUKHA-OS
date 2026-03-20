'use server';
/**
 * @fileOverview AI Flow for generating human-like voice greetings.
 * 
 * - generateGreetingAudio - Generates audio URI for the user greeting.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';

const GreetingTTSInputSchema = z.object({
  greeting: z.string().describe("The time-based greeting (e.g., Good morning)"),
  userName: z.string().describe("The name of the user to greet"),
});

export async function generateGreetingAudio(input: { greeting: string, userName: string }): Promise<string> {
  const result = await greetingTTSFlow(input);
  return result.audioUri;
}

/**
 * Converts PCM audio data to a WAV Base64 string.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const greetingTTSFlow = ai.defineFlow(
  {
    name: 'greetingTTSFlow',
    inputSchema: GreetingTTSInputSchema,
    outputSchema: z.object({ audioUri: z.string() }),
  },
  async (input) => {
    // Strictly formatted text for human-like greeting
    const text = `${input.greeting}, ${input.userName}.`;
    
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }, // Warm, professional voice with subtle smile
          },
        },
      },
      prompt: text,
    });

    if (!media || !media.url) {
      throw new Error('Failed to generate audio greeting.');
    }

    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    return {
      audioUri: 'data:audio/wav;base64,' + (await toWav(audioBuffer)),
    };
  }
);
