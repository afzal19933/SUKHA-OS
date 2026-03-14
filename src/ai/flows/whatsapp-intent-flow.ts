
'use server';
/**
 * @fileOverview AI Flow to interpret WhatsApp messages and convert to structured queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const WhatsAppIntentInputSchema = z.object({
  message: z.string().describe("The incoming WhatsApp message text."),
  role: z.string().describe("The role of the sender (Guest, Manager, Admin, Owner).")
});

const WhatsAppIntentOutputSchema = z.object({
  intent: z.string().describe("The identified operational intent (e.g., StatusQuery, RevenueReport)."),
  structuredQuery: z.string().describe("The internal system command (e.g., GET /reports/occupancy)."),
  response: z.string().describe("The natural language response to send back.")
});

export type WhatsAppIntentInput = z.infer<typeof WhatsAppIntentInputSchema>;
export type WhatsAppIntentOutput = z.infer<typeof WhatsAppIntentOutputSchema>;

const intentPrompt = ai.definePrompt({
  name: 'whatsappIntentPrompt',
  input: { schema: WhatsAppIntentInputSchema },
  output: { schema: WhatsAppIntentOutputSchema },
  prompt: `You are the SUKHA OS AI Intent Engine. You translate WhatsApp messages from staff and guests into system queries.

USER ROLE: {{{role}}}
MESSAGE: {{{message}}}

CAPABILITIES:
- If Manager asks for status: StatusQuery -> GET /reports/today_status
- If Admin asks for report: ReportQuery -> GET /reports/daily_full
- If Owner asks for revenue: RevenueQuery -> GET /reports/revenue_monthly
- If Guest asks for help: GuestSupport -> HELP /support/general

INSTRUCTIONS:
- Only Managers/Admins/Owners can request reports.
- If intent is unclear, respond with "I could not understand your request. Please try again."
- Structure the 'response' as a friendly, professional hospitality message.`,
});

export async function processWhatsAppIntent(input: WhatsAppIntentInput): Promise<WhatsAppIntentOutput> {
  const { output } = await intentPrompt(input);
  if (!output) throw new Error("AI failed to process intent.");
  return output;
}
