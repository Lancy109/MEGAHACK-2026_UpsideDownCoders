import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emitToAll } from '@/lib/socket';

// Twilio sends POST to this URL when SMS is received
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from    = (formData.get('From') as string)  || '';
    const body    = (formData.get('Body') as string)  || '';
    const msgBody = body.trim().toUpperCase();

    console.log(`[SMS Webhook] Received from ${from}: ${body}`);

    // Parse SOS SMS format
    // Accepted formats:
    // SOS MEDICAL 19.0760 72.8777
    // SOS FOOD 19.0760 72.8777
    // SOS RESCUE 19.0760 72.8777
    let type        = 'RESCUE';
    let lat         = 0;
    let lng         = 0;
    let hasGPS      = false;
    let description = `Emergency SOS received via SMS from ${from}`;

    // Verify it is a ResQNet SOS command
    if (!msgBody.startsWith('SOS') && !msgBody.startsWith('HELP')) {
      const twimlFallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>ResQNet: Command not recognized. 
To send SOS reply with: SOS [TYPE] [LAT] [LNG]
Types: MEDICAL, FOOD, RESCUE
Example: SOS MEDICAL 19.0760 72.8777</Message>
</Response>`;
      return new Response(twimlFallback, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Parse Type
    if (msgBody.includes('MEDICAL')) type = 'MEDICAL';
    else if (msgBody.includes('FOOD')) type = 'FOOD';
    else if (msgBody.includes('RESCUE')) type = 'RESCUE';

    // Parse GPS (matches two floating point numbers)
    const coordRegex = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/;
    const coordMatch = body.match(coordRegex);
    if (coordMatch) {
      lat    = parseFloat(coordMatch[1]);
      lng    = parseFloat(coordMatch[2]);
      hasGPS = true;
      description = `${type} emergency via SMS broadcast from ${from}. GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    // Find or create victim record
    let user = await prisma.user.findFirst({ where: { phone: from } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: `sms_${from.replace(/\+/g, '')}`,
          name: `SMS VICTIM (${from.slice(-4)})`,
          email: `${from.replace(/\+/g, '')}@resqnet.sms`,
          phone: from,
          role: 'VICTIM',
          lat: hasGPS ? lat : null,
          lng: hasGPS ? lng : null,
        }
      });
    }

    // Create SOS Alert
    const sos = await prisma.sOSAlert.create({
      data: {
        userId: user.id,
        type,
        description,
        lat: hasGPS ? lat : (user.lat || 19.0760),
        lng: hasGPS ? lng : (user.lng || 72.8777),
        status: 'ACTIVE',
        language: 'English',
      },
      include: {
        user: { select: { name: true, phone: true } }
      }
    });

    // Broadcast update to real-time maps
    emitToAll('new_sos', sos);

    const replyMsg = hasGPS
      ? `ResQNet: ${type} SOS RECEIVED! Volunteers notified. GPS Lock: ${lat.toFixed(4)},${lng.toFixed(4)}. Stay calm, help is coming. SOS_ID: ${sos.id.slice(-6).toUpperCase()}`
      : `ResQNet: ${type} SOS RECEIVED! Volunteers alerted. For high-speed rescue, reply with: SOS ${type} [LAT] [LNG].`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMsg}</Message>
</Response>`;

    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (err: any) {
    console.error('[SMS Webhook Error]', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>ResQNet: SOS logic error. Please try again or call emergency lines.</Message></Response>`, {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
