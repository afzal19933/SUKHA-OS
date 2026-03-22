/**
 * @fileOverview Real WhatsApp Cloud API Client.
 * Handles outbound communication with Meta Graph API.
 */

const WHATSAPP_VERSION = 'v21.0';

/**
 * Sends a message via Meta Cloud API using property-specific credentials.
 */
export async function sendRealWhatsAppMessage(
  phoneNumberId: string, 
  accessToken: string, 
  to: string, 
  text: string
) {
  if (!phoneNumberId || !accessToken) {
    console.error("WhatsApp API credentials missing for this property.");
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
      console.error("WhatsApp API Error Response:", JSON.stringify(result, null, 2));
    }
    return result;
  } catch (error) {
    console.error("Failed to execute WhatsApp API request:", error);
    throw error;
  }
}
