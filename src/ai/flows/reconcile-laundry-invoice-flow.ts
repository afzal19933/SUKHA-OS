
'use server';
/**
 * @fileOverview AI Flow for reconciling Signature Laundry invoices.
 * 
 * - reconcileLaundryInvoice - Analyzes an invoice photo and compares it with internal records.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReconcileInputSchema = z.object({
  invoicePhotoUri: z.string().describe("Data URI of the laundry firm's invoice image."),
  recordedBatches: z.array(z.object({
    date: z.string(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.number(),
      rate: z.number()
    }))
  })).describe("Internal records for the period being reconciled.")
});

const DiscrepancySchema = z.object({
  date: z.string(),
  itemName: z.string(),
  recordedQty: z.number(),
  invoiceQty: z.number(),
  recordedRate: z.number(),
  invoiceRate: z.number(),
  issue: z.string().describe("Description of the mismatch (e.g., 'Overcharged', 'Missing items')")
});

const ReconcileOutputSchema = z.object({
  summary: z.string().describe("A summary of the reconciliation results."),
  discrepancies: z.array(DiscrepancySchema),
  totalInvoiceAmount: z.number().describe("Total amount calculated from the invoice image."),
  isMatch: z.boolean().describe("Whether the invoice matches the recorded batches.")
});

export type ReconcileLaundryInput = z.infer<typeof ReconcileInputSchema>;
export type ReconcileLaundryOutput = z.infer<typeof ReconcileOutputSchema>;

const reconcilePrompt = ai.definePrompt({
  name: 'reconcileLaundryPrompt',
  input: { schema: ReconcileInputSchema },
  output: { schema: ReconcileOutputSchema },
  prompt: `You are a professional hotel auditor. Your task is to cross-match an invoice from "Signature Laundry Services" (provided as an image) against our internal laundry logs.

INSTRUCTIONS:
1. Extract every item, quantity, date, and unit price from the invoice image.
2. Compare these against the provided 'recordedBatches'.
3. Identify any discrepancies in:
   - Quantities (did they charge for more items than we sent?)
   - Rates (is the price per item higher than our agreed rate?)
   - Missing entries (is there a date on the invoice that isn't in our logs?)

Internal Records:
{{#each recordedBatches}}
Date: {{{date}}}
Items:
{{#each items}}
- {{{name}}}: {{{quantity}}} pcs @ ₹{{{rate}}}
{{/each}}
{{/each}}

Invoice Photo: {{media url=invoicePhotoUri}}`,
});

export async function reconcileLaundryInvoice(input: ReconcileLaundryInput): Promise<ReconcileLaundryOutput> {
  const { output } = await reconcilePrompt(input);
  if (!output) throw new Error("AI failed to generate a reconciliation report.");
  return output;
}
