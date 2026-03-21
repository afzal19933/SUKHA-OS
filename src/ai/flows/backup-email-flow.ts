'use server';
/**
 * @fileOverview AI Flow for generating backup audit summaries.
 * 
 * - generateBackupSummary - Composes a clinical audit text for the backup email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BackupEmailInputSchema = z.object({
  metadata: z.any().describe("The backup metadata object."),
  data: z.any().describe("The collections data object.")
});

const BackupEmailOutputSchema = z.object({
  subject: z.string(),
  body: z.string()
});

export type BackupEmailInput = z.infer<typeof BackupEmailInputSchema>;
export type BackupEmailOutput = z.infer<typeof BackupEmailOutputSchema>;

const summaryPrompt = ai.definePrompt({
  name: 'backupEmailSummaryPrompt',
  input: { schema: BackupEmailInputSchema },
  output: { schema: BackupEmailOutputSchema },
  prompt: `You are the SUKHA OS Data Custodian. Generate a clinical audit summary for a system backup email.

INSTRUCTIONS:
1. Subject must follow: "SUKHA OS Backup — {{{metadata.propertyName}}} — {{currentDate}}"
2. Body must include:
   - Success confirmation.
   - Property Name and Generation Date.
   - A list of collections and their record counts based on the 'data' provided.
   - Total record count.
   - A professional closing.

DATA CONTEXT:
- Metadata: {{{metadata}}}
- Collections Audit: {{#each data}} - {{ @key }}: {{this.length}} records {{/each}}

Format the body clearly with professional spacing.`,
});

export const generateBackupEmailContent = ai.defineFlow(
  {
    name: 'generateBackupEmailContent',
    inputSchema: BackupEmailInputSchema,
    outputSchema: BackupEmailOutputSchema,
  },
  async (input) => {
    const { output } = await summaryPrompt({
      ...input,
      currentDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });
    return output!;
  }
);