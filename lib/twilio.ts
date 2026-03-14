import twilio from 'twilio';

/**
 * Safely initializes a Twilio client without crashing the process.
 * Twilio's constructor throws an error if the SID does not start with 'AC'.
 */
export function safeGetTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return null;
  }

  // Twilio Account SIDs MUST start with 'AC'
  if (!sid.startsWith('AC')) {
    console.error(`[Twilio] Invalid Account SID format: Expected prefix 'AC', got '${sid.substring(0, 2)}'. Skipping initialization.`);
    return null;
  }

  try {
    return twilio(sid, token);
  } catch (err) {
    console.error('[Twilio] Initialization failed:', err);
    return null;
  }
}
