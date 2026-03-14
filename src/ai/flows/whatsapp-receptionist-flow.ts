
'use server';
/**
 * @fileOverview AI Receptionist Flow for WhatsApp Guest Interactions.
 * 
 * - whatsappReceptionist - Handles natural language responses for guests.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReceptionistInputSchema = z.object({
  message: z.string().describe("The incoming message from the guest."),
  guestName: z.string().optional().describe("The name of the guest if known.")
});

const ReceptionistOutputSchema = z.object({
  response: z.string().describe("The polite receptionist response.")
});

export type ReceptionistInput = z.infer<typeof ReceptionistInputSchema>;
export type ReceptionistOutput = z.infer<typeof ReceptionistOutputSchema>;

const receptionistPrompt = ai.definePrompt({
  name: 'whatsappReceptionistPrompt',
  input: { schema: ReceptionistInputSchema },
  output: { schema: ReceptionistOutputSchema },
  prompt: `You are a polite and professional hotel receptionist for Sukha Retreats. 
Your goal is to provide helpful, short, and natural responses to guest inquiries via WhatsApp.

KNOWLEDGE BASE:
- WiFi Name: Sukha Retreats
- WiFi Password: Sukha@123
- Swimming Pool Timings: 6:00 AM – 9:00 PM
- Gym Timings: 6:00 AM – 9:00 PM
- Check-in Time: 2:00 PM
- Checkout Time: 11:00 AM
- Facilities: Swimming pool, Gym, Garden, Prayer room, Laundry service.
- Ayursiha Hospital: Operates in the same building but is managed separately.

RULES:
1. If the guest greets you (hi, hello, etc.), respond politely with a welcome.
2. Answer ONLY the question asked. 
3. Do not list all options or facilities unless specifically asked.
4. Keep responses very short, natural, and friendly.
5. Use emojis sparingly (e.g., 🌿, 😊).

Guest Message: {{{message}}}
Guest Name (if known): {{{guestName}}}`,
});

export async function getReceptionistResponse(input: ReceptionistInput): Promise<string> {
  const { output } = await receptionistPrompt(input);
  if (!output) return "Welcome to Sukha Retreats 🌿 How can I help you?";
  return output.response;
}
