
import { NextRequest, NextResponse } from 'next/server';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';

/**
 * WhatsApp Webhook Route Handler
 * Supports Meta Verification (GET) and Message Events (POST)
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse(null, { status: 403 });
    }
  }
  return new NextResponse(null, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if it's a valid WhatsApp message event
    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const messageObj = body.entry[0].changes[0].value.messages[0];
      const from = messageObj.from; // Sender phone number
      const text = messageObj.text?.body; // Message text

      if (!text) {
        return NextResponse.json({ status: 'ignored' });
      }

      const lowerText = text.toLowerCase().trim();
      const greetings = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening'];
      
      let replyText = "";

      if (greetings.some(g => lowerText.startsWith(g))) {
        replyText = "Welcome to Sukha Retreats 🌿\nHow can I help you?";
      } else {
        // Use Gemini AI for complex queries
        replyText = await getReceptionistResponse({ message: text });
      }

      // Send the reply back via WhatsApp API
      await sendRealWhatsAppMessage(from, replyText);

      return NextResponse.json({ status: 'success' });
    }

    return NextResponse.json({ status: 'not_a_message' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
