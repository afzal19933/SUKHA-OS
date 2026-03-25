/**
 * @fileOverview Real WhatsApp Cloud API Client.
 * Handles outbound communication with Meta Graph API with built-in retry logic.
 */

const WHATSAPP_VERSION = 'v20.0';
const MAX_RETRIES = 2;

/**
 * Wrapper for API calls with built-in retry logic for production stability.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`[WhatsApp API] Retrying dispatch... (${retries} attempts left)`);
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await withRetry(fn, retries - 1);
    }
    throw error;
  }
}

/**
 * Sends a message via Meta Cloud API using property-specific credentials.
 * Includes FULL DEBUG LOGGING and Auto-Retry for high-latency environments.
 */
export async function sendRealWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
) {
  return withRetry(async () => {
    try {
      if (!phoneNumberId || !accessToken) {
        throw new Error("WhatsApp API credentials missing.");
      }

      const formattedTo = to.replace("+", "");
      const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${phoneNumberId}/messages`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: {
            preview_url: false,
            body: text,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result?.error?.message || "Unknown Meta API Error";
        throw new Error(`Meta API Error: ${errorMessage}`);
      }

      return result;
    } catch (error: any) {
      console.error("❌ WhatsApp Outbound Failure:", error.message);
      throw error;
    }
  });
}
