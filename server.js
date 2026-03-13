const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

// Fix Next 15/16 Turbopack multiple lockfile warning by strictly binding to project dir
process.env.TURBOPACK_ROOT = process.cwd();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  global._io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Legacy SOS room (kept for backward compat)
    socket.on('join_sos_room', (sosId) => {
      socket.join(`sos-${sosId}`);
    });

    // Per-SOS live chat rooms
    socket.on('join_chat', (sosId) => {
      socket.join(`chat_${sosId}`);
    });
    socket.on('leave_chat', (sosId) => {
      socket.leave(`chat_${sosId}`);
    });

    // Typing indicators — broadcast to room except sender
    socket.on('typing_start', ({ sosId, userId, name }) => {
      socket.to(`chat_${sosId}`).emit('typing_start', { userId, name });
    });
    socket.on('typing_stop', ({ sosId, userId }) => {
      socket.to(`chat_${sosId}`).emit('typing_stop', { userId });
    });

    // Relay messages (workaround for API route isolation)
    socket.on('broadcast_message', (msg) => {
      socket.to(`chat_${msg.sosId}`).emit('chat_message', msg);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Auto-escalation: check every 2 minutes for unattended SOS
  setInterval(async () => {
    try {
      console.log('Running auto-escalation check...');
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const unattended = await prisma.sosAlert.findMany({
        where: { 
          status: 'ACTIVE', 
          createdAt: { lte: tenMinutesAgo } 
        },
        include: { user: true },
      });

      for (const sos of unattended) {
        console.log(`Escalating SOS ${sos.id}...`);
        // Emit urgent alert to NGO dashboard
        io.emit('escalation_alert', {
          sosId: sos.id,
          type: sos.type,
          description: sos.description,
          lat: sos.lat,
          lng: sos.lng,
          minutesWaiting: Math.floor((Date.now() - new Date(sos.createdAt)) / 60000),
          victimName: sos.user.name,
          victimPhone: sos.user.phone,
        });

        // Send urgent SMS to NGO (store NGO phones in env)
        if (process.env.NGO_EMERGENCY_PHONE && process.env.TWILIO_ACCOUNT_SID) {
          try {
            const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await twilio.messages.create({
              body: `🚨 URGENT ResQNet: SOS unattended for 10+ mins. Type: ${sos.type}. Victim: ${sos.user.name} ${sos.user.phone}. Location: ${sos.lat},${sos.lng}. Manual intervention needed.`,
              from: process.env.TWILIO_PHONE,
              to: process.env.NGO_EMERGENCY_PHONE,
            });
          } catch (smsErr) {
            console.error('Twilio SMS failed:', smsErr);
          }
        }
      }
    } catch (err) {
      console.error('Escalation check error:', err);
    }
  }, 2 * 60 * 1000);

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
