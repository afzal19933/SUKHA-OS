
'use server';
/**
 * @fileOverview AI Flow for holistic property operational analysis.
 * 
 * - analyzeProperty - Analyzes multi-module data to generate management alerts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalysisInputSchema = z.object({
  inventory: z.array(z.any()).optional(),
  accounting: z.array(z.any()).optional(),
  laundry: z.array(z.any()).optional(),
  maintenance: z.array(z.any()).optional(),
  rooms: z.array(z.any()).optional()
});

const AlertSchema = z.object({
  category: z.enum(['inventory', 'accounting', 'laundry', 'maintenance', 'housekeeping', 'system']),
  severity: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  suggestion: z.string()
});

const AnalysisOutputSchema = z.object({
  summary: z.string(),
  alerts: z.array(AlertSchema),
  score: z.number().describe("Overall operational health score out of 100")
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'propertyAnalysisPrompt',
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `You are the SUKHA OS Operational Auditor. Your task is to analyze hotel property data across multiple modules and identify risks, shortages, and efficiency gaps.

DATA CONTEXT:
- Inventory: {{{inventory}}}
- Accounting (Invoices): {{{accounting}}}
- Laundry (Orders & Batches): {{{laundry}}}
- Maintenance (Tasks & Schedules): {{{maintenance}}}
- Room Status: {{{rooms}}}

ANALYSIS GUIDELINES:
1. INVENTORY: Flag items where currentStock <= minStock. Look for high-consumption items.
2. ACCOUNTING: Flag "unpaid" invoices older than 3 days. Mention high-value receivables.
3. LAUNDRY: Flag orders marked "sent" for more than 48 hours. Detect high vendor dues.
4. MAINTENANCE: Flag "high" priority repairs that aren't "completed". Note upcoming "routine" tasks.
5. HOUSEKEEPING: Suggest "Deep Cleaning" for rooms that have been "dirty" for more than 12 hours.
6. OVERALL: Provide a summary of the property's health and a score.

Be professional, concise, and operational. Use hospitality terminology.`,
});

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const { output } = await analysisPrompt(input);
  if (!output) throw new Error("AI Analysis failed.");
  return output;
}
