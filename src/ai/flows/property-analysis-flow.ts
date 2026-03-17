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
- Accounting (Unpaid Invoices): {{{accounting}}}
- Laundry (Unpaid Orders): {{{laundry}}}
- Maintenance (Open Tasks): {{{maintenance}}}
- Room Status: {{{rooms}}}

CRITICAL INSTRUCTIONS:
1. USE ONLY THE DATA PROVIDED. 
2. DO NOT HALLUCINATE. If a specific room, stock item, or invoice is not in the context, do not mention it.
3. DO NOT USE EXAMPLES AS REAL DATA. 
4. If a module (e.g. Inventory) has no data or an empty array, simply skip analysis for that module and note its absence in the summary.
5. Provide a realistic health score based ONLY on the alerts found. 100 means no alerts found in provided data.

ANALYSIS GUIDELINES:
- INVENTORY: Flag items where currentStock <= minStock.
- ACCOUNTING: Flag "unpaid" invoices. 
- LAUNDRY: Flag guest orders where status is not 'paid'.
- MAINTENANCE: Flag "high" priority repairs that aren't "completed".
- HOUSEKEEPING: From the 'rooms' data, identify rooms where status is 'dirty' or 'occupied_dirty'. Suggest cleaning.

Be professional, concise, and operational. Use hospitality terminology.`,
});

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const { output } = await analysisPrompt(input);
  if (!output) throw new Error("AI Analysis failed.");
  return output;
}
