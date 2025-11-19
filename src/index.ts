// src/index.ts
import { ChatRoom } from "./ChatRoom";
import { DebateWorkflow } from "./DebateWorkflow";

export { ChatRoom, DebateWorkflow };

// --- THE UI CODE ---
const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Debate Arena</title>
  <style>
    :root {
      --bg: #181818;
      --card: #181818;
      --text: #e2e8f0;
      --accent: #FF5722;
      --agent-a: #3b82f6; /* Blue */
      --agent-b: #ef4444; /* Red */
    }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      padding: 1rem;
      background: var(--bg);
      border-bottom: 1px solid #6b6b6b;
      text-align: center;
      backdrop-filter: blur(10px);
      z-index: 10;
    }
    h1 { margin: 0; font-size: 1.75rem; letter-spacing: 1px; text-transform: uppercase; }
    
    #chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      scroll-behavior: smooth;
    }

    .message {
      max-width: 80%;
      padding: 1rem;
      border-radius: 12px;
      line-height: 1.5;
      opacity: 0;
      transform: translateY(20px);
      animation: popIn 0.5s forwards ease-out;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .agent-a { align-self: flex-start; border-left: 4px solid var(--agent-a); background: #1e293b; }
    .agent-b { align-self: flex-end; border-right: 4px solid var(--agent-b); background: #2a2a2a; text-align: right;}
    .system { align-self: center; background: transparent; color: var(--text); font-size: 0.8rem; border: 1px solid #6b6b6b; }

    .sender-name {
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      font-weight: bold;
      color: var(--text);
    }

    @keyframes popIn {
      to { opacity: 1; transform: translateY(0); }
    }

    #controls {
      padding: 1.5rem;
      background: var(--card);
      display: flex;
      gap: 1rem;
      border-top: 1px solid #6b6b6b;
    }

    input {
      flex: 1;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #6b6b6b;
      background: var(--bg);
      color: white;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #dedede; }

    button {
      padding: 0 2rem;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:disabled { background: #475569; cursor: not-allowed; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ Debate Arena ⚡</h1>
  </header>

  <div id="chat-container">
    <div class="message system">Waiting for connection...</div>
  </div>

  <div id="controls">
    <input type="text" id="topicInput" placeholder="Enter a controversial topic (e.g., Cats vs Dogs)..." autocomplete="off">
    <button id="sendBtn">Start Debate</button>
  </div>

  <script>
    const chat = document.getElementById('chat-container');
    const input = document.getElementById('topicInput');
    const btn = document.getElementById('sendBtn');
    
    // Auto-connect to the WebSocket on the same host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = \`\${protocol}//\${window.location.host}/websocket\`;
    let ws;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addMessage("System", "Connected! Enter a topic to start.", "system");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle history (array) or single message
        if (data.type === 'history') {
            data.data.forEach(msg => addMessage(msg.sender, msg.text));
        } else {
            // Determine style based on sender name
            let style = "system";
            if (data.sender === "Agent A") style = "agent-a";
            if (data.sender === "Agent B") style = "agent-b";
            
            addMessage(data.sender, data.text, style);
        }
      };

      ws.onclose = () => {
        addMessage("System", "Disconnected. Reconnecting...", "system");
        setTimeout(connect, 2000);
      };
    }

    function addMessage(sender, text, type) {
      if(!text) return;
      const div = document.createElement('div');
      div.className = \`message \${type || ''}\`;
      div.innerHTML = \`
        <div class="sender-name">\${sender || 'Unknown'}</div>
        <div>\${text}</div>
      \`;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    btn.addEventListener('click', () => {
      const topic = input.value.trim();
      if (!topic) return;
      
      // Send to Backend
      ws.send(JSON.stringify({ type: 'start_debate', topic: topic }));
      
      addMessage("You", \`Topic Proposed: \${topic}\`, "system");
      input.value = '';
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    connect();
  </script>
</body>
</html>
`;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    // 1. Serve the UI if hitting the root URL
    if (url.pathname === "/") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // 2. Otherwise, send traffic to the ChatRoom Durable Object
    const id = env.CHAT_ROOM.idFromName("global-debate-room");
    const stub = env.CHAT_ROOM.get(id);

    return stub.fetch(request);
  }
};