
'use server';
/**
 * @fileOverview Global AI Assistant Flow for SUKHA OS.
 * 
 * This flow acts as the central intelligence for the system, capable of 
 * understanding natural language commands to navigate, query data, 
 * and assist with property operations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIAssistantInputSchema = z.object({
  query: z.string().describe("The user's natural language command or question."),
  currentPath: z.string().optional().describe("The current URL path the user is on."),
  context: z.any().optional().describe("Contextual data like room numbers or guest names currently visible.")
});

const AIAssistantOutputSchema = z.object({
  message: z.string().describe("The text response from the AI."),
  action: z.object({
    type: z.enum(['navigate', 'search', 'notify', 'none']),
    payload: z.string().optional().describe("The destination path or search query.")
  }).optional()
});

export type AIAssistantInput = z.infer<typeof AIAssistantInputSchema>;
export type AIAssistantOutput = z.infer<typeof AIAssistantOutputSchema>;

/**
 * System Prompt for the SUKHA OS Assistant
 */
const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: { schema: AIAssistantInputSchema },
  output: { schema: AIAssistantOutputSchema },
  prompt: `You are the SUKHA OS AI Concierge, a highly capable assistant for Sukha Retreats and Sukha Paradise.
You help staff manage property operations through natural language.

CURRENT CONTEXT:
- Path: {{{currentPath}}}
- Context: {{{context}}}

CAPABILITIES:
1. NAVIGATION: You can take the user to any module (Dashboard, Reservations, Housekeeping, Rooms, Laundry, Maintenance, Accounting, Settings).
2. SEARCH: You can help find guest information.
3. OPERATIONAL ADVICE: You can answer questions about how to use the system.

INSTRUCTIONS:
- If the user asks to "go to" or "open" a page, set action.type to 'navigate' and action.payload to the relative path (e.g., '/housekeeping').
- If the user asks about a guest or room, provide a helpful summary based on the context.
- Be concise, professional, and helpful. Use a welcoming hospitality tone.

User Query: {{{query}}}`,
});

export async function askAssistant(input: AIAssistantInput): Promise<AIAssistantOutput> {
  const { output } = await assistantPrompt(input);
  if (!output) throw new Error("AI Assistant failed to respond.");
  return output;
}
