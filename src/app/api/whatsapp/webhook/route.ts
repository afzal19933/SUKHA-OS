import { NextRequest, NextResponse } from 'next/server';

/**
 * WhatsApp Webhook Route Handler (FIXED VERSION)
 */

const VERIFY_TOKEN = 'sukha_os_verify';

// ✅ GET → Verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('--- WEBHOOK VERIFICATION ---');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ VERIFIED');

    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Verification failed', { status: 403 });
}


// ✅ POST → Receive messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('📩 INCOMING MESSAGE:');
    console.log(JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) {
      return NextResponse.json({ status: 'ignored' });
    }

    const from = messageObj.from;
    const text = messageObj.text?.body;

    console.log(`📱 From: ${from}`);
    console.log(`💬 Message: ${text}`);

    // 🔥 Simple auto-reply (for testing)
    console.log("🚀 Auto reply would be sent here");

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error("❌ WEBHOOK ERROR:", error);

    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}