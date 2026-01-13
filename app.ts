const server = Bun.serve({
  fetch(req, server) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const originDomain = origin?.split('://')[1];
    const allowedOrigins = import.meta.env.ALLOWED_ORIGINS?.split(',');

    if (req.headers.get("upgrade") === "websocket") {
      if (origin && allowedOrigins) {
        if (!originDomain || !allowedOrigins.includes(originDomain)) {
          console.log('WebSocket origin not allowed:', originDomain);
          return new Response("Origin not allowed", { status: 403 });
        }
      }

      const success = server.upgrade(req, {
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Credentials": "true",
        },
      });

      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      if (origin && allowedOrigins) {
        if (!originDomain || !allowedOrigins.includes(originDomain)) {
          return new Response("Origin not allowed", {
            status: 403,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      return (async () => {
        try {
          const body = await req.json() as { room: string, action: string };

          if (!body.room || !body.action) {
            return new Response(JSON.stringify({ error: "Room and message are required" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": origin || "*",
              }
            });
          }

          const roomId = req.headers.get('x-provider-id') || 'default';

          server.publish(roomId, JSON.stringify({ action: body.action, room: body.room, timestamp: new Date().toISOString() }));

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": origin || "*",
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": origin || "*",
            }
          });
        }
      })();
    }

    if (url.pathname === "/" && req.method === "GET") {
      return new Response("Hello, world!", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
        }
      });
    }

    // Route non trouvée
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    message: async (ws, message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.action === "subscribe" && parsedMessage.provider) {
          ws.subscribe(parsedMessage.provider);
        }
      } catch (error) {
        console.log('websocket message error', error);
      }
    },
  },
  port: parseInt(import.meta.env.PORT || "80"),

});

console.log(`Server running at ${server.url}`);