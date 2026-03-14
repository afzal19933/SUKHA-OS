
/**
 * @fileOverview Real WhatsApp Cloud API Client.
 * Handles outbound communication with Meta Graph API.
 */

const WHATSAPP_VERSION = 'v21.0';

export async function sendRealWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error("WhatsApp API credentials missing in environment variables.");
    return;
  }

  const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          preview_url: false,
          body: text
        }
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("WhatsApp API Error:", result);
    }
    return result;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw error;
  }
}
