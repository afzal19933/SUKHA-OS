
'use server';
/**
 * @fileOverview AI Flow for generating human-like voice greetings.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';

const GreetingTTSInputSchema = z.object({
  greeting: z.string().describe("The greeting prefix (e.g., Welcome)"),
  userName: z.string().describe("The name of the user to greet"),
});

/**
 * Generates high-quality greeting audio.
 */
export async function generateGreetingAudio(input: { greeting: string, userName: string }): Promise<string> {
  try {
    const result = await greetingTTSFlow(input);
    return result.audioUri;
  } catch (error: any) {
    console.error("AI Greeting Audio Generation Failed:", error.message);
    return "";
  }
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
    writer.on('error', (err) => {
      console.error("WAV Writer Error:", err);
      reject(err);
    });
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
    // Strictly formatted text: "Welcome {{user_name}}"
    const text = `${input.greeting} ${input.userName}.`;
    
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
      prompt: text,
    });

    if (!media || !media.url) {
      throw new Error('Failed to generate audio greeting.');
    }

    const base64Parts = media.url.split(',');
    const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
    
    if (!base64Data) {
      throw new Error('Invalid audio media format');
    }

    const audioBuffer = Buffer.from(base64Data, 'base64');
    const wavBase64 = await toWav(audioBuffer);

    return {
      audioUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
