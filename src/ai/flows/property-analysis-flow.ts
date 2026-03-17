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
  prompt: `You are the SUKHA OS Strategic Data Analyst & Auditor. Your task is to perform quantitative and qualitative analysis on hotel property data.

DATA CONTEXT:
- Inventory: {{{inventory}}}
- Accounting (Unpaid Invoices): {{{accounting}}}
- Laundry (Unpaid Orders): {{{laundry}}}
- Maintenance (Open Tasks): {{{maintenance}}}
- Room Status: {{{rooms}}}

CRITICAL INSTRUCTIONS:
1. USE ONLY THE DATA PROVIDED. 
2. DO NOT HALLUCINATE figures or entities. If a module is empty, state "Data not available" for that module.
3. IF ALL MODULES HAVE NO DATA, set the health score to 0 and the summary to "Operational data unavailable for analysis."
4. ANALYTICS CAPABILITIES:
   - Calculate KPIs based on the density of data. 
   - Example: Inventory Shortage Ratio = (items below min / total items).
   - Example: Maintenance Resolution Velocity = (completed vs pending repair ratio).
   - Example: Revenue Settlement Risk = (total unpaid value vs time elapsed).

ANALYSIS GUIDELINES:
- INVENTORY: Analyze current stock vs min levels to detect replenishment trends.
- ACCOUNTING: Analyze the aging of unpaid invoices.
- LAUNDRY: Identify guest folio risks.
- MAINTENANCE: Determine if there is a growing repair backlog.
- HOUSEKEEPING: Look for 'stale dirty' rooms (rooms updated long ago but still dirty).

OUTPUT FORMAT:
- summary: A high-level executive briefing.
- alerts: Specific critical or warning flags.
- score: 0-100 based strictly on data presence and alert severity.
- kpis: At least 3 specific analytical metrics derived from the context. If data is too thin for a metric, describe it as 'Establishing Baseline'.

Professional hospitality and data-driven tone.`,
});

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const { output } = await analysisPrompt(input);
  if (!output) throw new Error("AI Analysis failed.");
  return output;
}
