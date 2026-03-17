'use server';
/**
 * @fileOverview AI Flow for holistic property operational analysis and data analytics.
 * 
 * - analyzeProperty - Analyzes multi-module data to generate management alerts and analytical KPIs.
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

const KPISchema = z.object({
  label: z.string().describe("The name of the metric (e.g., 'Stock Replenishment Urgency')"),
  value: z.string().describe("The numerical or percentage value of the metric"),
  trend: z.enum(['up', 'down', 'stable']).describe("The direction of the metric compared to the general logs"),
  description: z.string().describe("Brief analytical context for this KPI")
});

const AnalysisOutputSchema = z.object({
  summary: z.string(),
  alerts: z.array(AlertSchema),
  score: z.number().describe("Overall operational health score out of 100. Set to 0 if no data is available."),
  kpis: z.array(KPISchema).optional().describe("Strategic data analytics metrics derived from the data context.")
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'propertyAnalysisPrompt',
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `You are the SUKHA OS Strategic Data Auditor. Your task is to perform strictly factual quantitative and qualitative analysis on hotel property data.

CRITICAL SECURITY & ACCURACY RULES:
1. USE ONLY THE PROVIDED DATA. 
2. DO NOT HALLUCINATE. If a list is empty, state "Data not available" for that specific module.
3. NEVER INVENT ROOM NUMBERS, ITEM NAMES, OR ENTITIES. If you mention a room number (e.g., "103"), it MUST exist in the 'Room Status' data provided.
4. IF A MODULE HAS DATA BUT NO ISSUES, DO NOT INVENT WARNINGS. Report "No critical issues detected" for that module.
5. IF ALL MODULES ARE EMPTY, set the health score to 0 and the summary to "Operational data unavailable for analysis."
6. DO NOT BE "HELPFUL" BY CREATING EXAMPLES. Only report on real data.

DATA CONTEXT:
- Inventory: {{{inventory}}}
- Accounting (Unpaid Invoices): {{{accounting}}}
- Laundry (Unpaid Orders): {{{laundry}}}
- Maintenance (Open Tasks): {{{maintenance}}}
- Room Status: {{{rooms}}}

ANALYSIS GUIDELINES:
- INVENTORY: Compare current stock vs min levels. If stock > min, there is NO shortage.
- ACCOUNTING: Check the dates of unpaid invoices. Only flag as "Aging" if they are older than 7 days.
- MAINTENANCE: Only flag "Backlog" if there are more than 3 'pending' tasks.
- HOUSEKEEPING: Only flag "Stale Dirty" if the 'updated' timestamp for a dirty room is older than the current date.

KPI CALCULATION:
- Mathematically derive values. 
- Inventory Shortage Ratio = (items below min / total items).
- Room Readiness Rate = (available rooms / total rooms).
- If a metric cannot be calculated precisely because lists are empty, set value to "N/A" and trend to "stable".

OUTPUT FORMAT:
- summary: High-level executive brief based ONLY on facts.
- alerts: Specific flags. (Empty array if no issues).
- score: 0-100 based strictly on presence of issues. (100 = No issues found in data provided).
- kpis: At least 3 specific analytical metrics derived FROM THE LISTS.`,
});

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const { output } = await analysisPrompt(input);
  if (!output) throw new Error("AI Analysis failed.");
  return output;
}
