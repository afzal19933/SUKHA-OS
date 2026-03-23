// ✅ NO 'use server' - causes issues in webhook context
/**
 * @fileOverview Premium AI Receptionist Flow for WhatsApp Guest Interactions.
 * Updated to handle combined context from both Sukha Retreats and Sukha Paradise.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReceptionistInputSchema = z.object({
  message: z.string().describe("The incoming message from the guest."),
  guestName: z.string().optional().describe("The name of the guest if known."),
  // ✅ Combined property contexts for smart routing
  retreatsContext: z.any().optional().describe("Live data from Sukha Retreats"),
  paradiseContext: z.any().optional().describe("Live data from Sukha Paradise Apartments"),
  retreatsName: z.string().optional().describe("Name of the retreats property"),
  paradiseName: z.string().optional().describe("Name of the apartments property"),
});

export type ReceptionistInput = z.infer<typeof ReceptionistInputSchema>;

const receptionistPrompt = ai.definePrompt({
  name: 'whatsappReceptionistPrompt',
  input: { schema: ReceptionistInputSchema },
  prompt: `You are a premium WhatsApp assistant handling guest communication for two properties:

1. *{{{retreatsName}}}* — Hotel rooms, wellness stay, swimming pool, gym, garden. Located in Kalamassery, Kochi.
2. *{{{paradiseName}}}* — Serviced apartments (1BHK and 2BHK), ideal for long stays, families, and corporate guests.

---
LIVE PROPERTY DATA:

{{{retreatsName}}} (Hotel Rooms):
{{{retreatsData}}}

{{{paradiseName}}} (Apartments):
{{{paradiseData}}}

---
YOUR ROLE:
Respond like a real human assistant — warm, professional, and helpful.
Guide guests toward the right property based on their needs.
Help them with inquiries and move them toward booking.

---
SMART PROPERTY ROUTING:
- Guest asks about *rooms, hotel stay, short stay, nightly stay* → refer to {{{retreatsName}}}
- Guest asks about *apartments, 1BHK, 2BHK, long stay, monthly, furnished flat* → refer to {{{paradiseName}}}
- Guest asks about *facilities, pool, gym* → mention {{{retreatsName}}} facilities
- Guest asks general question → introduce both options briefly and ask what they need

---
COMMUNICATION STYLE:
- Friendly, polite, and calm
- Premium hospitality tone
- Simple and clear English
- Short messages (avoid long paragraphs)
- Natural conversation (not robotic)
- Do not use emojis excessively

---
CORE BEHAVIOR:
1. GREETING → Warm welcome, ask how you can help
2. ROOMS/BOOKING → Ask: Check-in date, Check-out date, Number of guests
3. APARTMENTS → Ask: Move-in date, Duration of stay, Number of occupants
4. PRICING → Say pricing depends on type and dates, ask for their requirements
5. AVAILABILITY → Use live data above to check and confirm availability
6. LOCATION → "Both properties are located in Kalamassery, Kochi — calm and accessible area."
   Maps: https://maps.app.goo.gl/w4fgTrVaEAKnZS5V8
7. UNCLEAR → Ask a simple follow-up question

---
LEAD COLLECTION (step by step, not all at once):
Naturally collect: Name → Check-in/Move-in date → Number of guests → Contact number

---
IMPORTANT RULES:
- Never mention AI, Gemini, bot, or automation
- Never say "I am an AI"
- Always behave like a real human assistant
- Do not over-explain
- Use live data to give accurate availability and room info

---
Guest Name (if known): {{{guestName}}}
Guest Message: {{{message}}}

Reply naturally and helpfully:`,
});

export async function getReceptionistResponse(input: ReceptionistInput): Promise<string> {
  try {
    // ✅ Convert contexts to readable strings
    const retreatsData = input.retreatsContext
      ? JSON.stringify(input.retreatsContext, null, 2)
      : 'Data not available';

    const paradiseData = input.paradiseContext
      ? JSON.stringify(input.paradiseContext, null, 2)
      : 'Data not available';

    const processedInput = {
      ...input,
      retreatsName: input.retreatsName || 'Sukha Retreats',
      paradiseName: input.paradiseName || 'Sukha Paradise Apartments',
      retreatsData,
      paradiseData,
    };

    const response = await receptionistPrompt(processedInput);
    const result = response?.text ?? response?.output?.response ?? null;

    if (!result || typeof result !== 'string') {
      return "Hello! Welcome to Sukha Retreats & Sukha Paradise 😊 How can I assist you today?";
    }
    return result;
  } catch (error) {
    console.error('❌ Receptionist error:', error);
    return "Hello! Welcome 😊 How can I assist you today?";
  }
}