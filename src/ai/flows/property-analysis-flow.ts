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
  score: z.number().describe("Overall operational health score out of 100. Set to 0 if data is insufficient."),
  kpis: z.array(KPISchema).optional().describe("Strategic data analytics metrics derived from the data context.")
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'propertyAnalysisPrompt',
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `You are the SUKHA OS Strategic Data Auditor. Perform a clinical operational audit on the provided data.

STRICT AUDIT RULES:
1. DATA SCOPE: Use ONLY the provided arrays. If an array is empty [], you MUST NOT calculate percentages or derive trends for that specific section.
2. NO DATA = NO ANALYTICS: If ALL provided data arrays are empty, return "Data not available" for all text fields and 0 for the health score.
3. ZERO TOLERANCE FOR HALLUCINATION: Never invent room numbers, item names, or quantities. If it isn't in the context, it doesn't exist.
4. HEALTH SCORE CALCULATION:
   - Start at 100.
   - Deduct 10 points for every empty module (data unavailable).
   - Deduct 15 points for every 'critical' alert found in the actual logs.
   - If 3 or more modules (inventory, laundry, maintenance, rooms, accounting) are empty [], set the health score to 0 immediately.
5. KPIs: If the data for a KPI is unavailable, set its value to "N/A" and its label to something descriptive like "Awaiting Data".

DATA CONTEXT:
- Inventory Stock: {{{inventory}}}
- Unpaid Invoices: {{{accounting}}}
- Laundry Orders (Unpaid): {{{laundry}}}
- Open Maintenance Tasks: {{{maintenance}}}
- Room Status Records: {{{rooms}}}

OUTPUT REQUIREMENTS:
- summary: A factual briefing. If data is missing, explicitly state "Audit incomplete due to missing module records."
- alerts: Specific flags based ONLY on data. (Empty array if no issues).
- score: 0-100 based strictly on presence of data and issues.
- kpis: Maximum 3 specific analytical metrics. Set value to "N/A" if data is sparse.`,
});

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const { output } = await analysisPrompt(input);
  if (!output) throw new Error("AI Analysis failed.");
  return output;
}
