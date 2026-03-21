import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateBackupEmailContent } from '@/ai/flows/backup-email-flow';

/**
 * Wired Backup Email API Route.
 * Uses Genkit for AI-composition and Nodemailer for technical dispatch.
 */
export async function POST(req: NextRequest) {
  try {
    const { backup, recipientEmail } = await req.json();

    if (!backup || !recipientEmail) {
      return NextResponse.json({ error: "Invalid backup data or recipient" }, { status: 400 });
    }

    // 1. Generate AI Clinical Audit Summary
    const aiContent = await generateBackupEmailContent({
      metadata: backup.metadata,
      data: backup.data
    });

    // 2. Configure Technical Transport
    // These should be configured in .env for production
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'sukhaparadise23@gmail.com', // Primary target
        pass: process.env.EMAIL_PASS, // Requires Gmail App Password
      },
    });

    // 3. Construct Multi-part Message
    const mailOptions = {
      from: `"SUKHA OS Cloud Vault" <${process.env.EMAIL_USER || 'sukhaparadise23@gmail.com'}>`,
      to: recipientEmail,
      subject: aiContent.subject,
      text: aiContent.body,
      attachments: [
        {
          filename: `sukhaos_${backup.metadata.propertyName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`,
          content: JSON.stringify(backup, null, 2),
          contentType: 'application/json'
        }
      ]
    };

    // 4. Dispatch (Fallback to simulation if no password provided)
    if (!process.env.EMAIL_PASS) {
      console.warn("[Email Service] EMAIL_PASS missing in .env. Simulating dispatch...");
      console.log("Subject:", mailOptions.subject);
      console.log("Body:", mailOptions.text);
      return NextResponse.json({ 
        success: true, 
        message: "Email dispatch simulated (Check server logs). To receive real emails, configure EMAIL_PASS in environment variables." 
      });
    }

    await transporter.sendMail(mailOptions);
    
    return NextResponse.json({ success: true, message: "Backup dispatched successfully to " + recipientEmail });
  } catch (error: any) {
    console.error("Backup Email Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
