const server = Bun.serve({
  fetch(req, server) {
    const origin = req.headers.get('origin');
    const originDomain = origin?.split('://')[1];
    const allowedOrigins = import.meta.env.ALLOWED_ORIGINS?.split(',');

    if (!originDomain || !allowedOrigins?.includes(originDomain)) return new Response("Origin not allowed", { status: 403 });

    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (success) return undefined;

      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    message: async (ws, message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.action === "subscribe" && parsedMessage.provider) {
          ws.subscribe(parsedMessage.provider);
        }
      } catch (error) {
        console.log('websocket message', error);
      }
    },
  },
  routes: {
    "/send": {
      POST: async (req) => {
        const body = await req.json() as { room: string, action: string };

        if (!body.room || !body.action) return new Response(JSON.stringify({ error: "Room and message are required" }), { status: 400 });

        const roomId = req.headers.get('x-provider-id') || 'default';

        server.publish(roomId, JSON.stringify({ action: body.action, room: body.room, timestamp: new Date().toISOString() }));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    },
  },
  port: import.meta.env.PORT || 3000,

});

console.log(`Server running at ${server.url}`);