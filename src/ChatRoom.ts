import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  sockets = new Set<WebSocket>();
  history: any[] = [];  // "Memory"

  async fetch(request: Request) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (url.pathname === "/websocket") {
      const pair = new WebSocketPair();
      this.handleSession(pair[1]);
      return new Response(null, {status: 101, webSocket: pair[0]});
    }

    // Handle receiving a new message from the internal Workflow
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const data = await request.json();
      this.history.push(data);
      this.broadcast(JSON.stringify(data));
      return new Response("OK");
    }

    return new Response("Not found", {status: 404});
  }

  handleSession(webSocket: WebSocket) {
    this.sockets.add(webSocket);
    webSocket.accept();
    
    // Send our pre-existing history on connect
    webSocket.send(JSON.stringify({ type: 'history', data: this.history }));

    webSocket.addEventListener("message", async (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'start_debate') {
        // Trigger the debate Workflow
        await this.env.DEBATE_WORKFLOW.create({
          params: { topic: msg.topic, roomId: this.ctx.id.toString() }
        });
      }
    });
    webSocket.addEventListener("close", () => this.sockets.delete(webSocket));
  }

  broadcast(message: string) {
    for (const socket of this.sockets) {
      socket.send(message);
    }
  }
}
