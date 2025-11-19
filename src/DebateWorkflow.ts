// src/DebateWorkflow.ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

type Message = { sender: string; text: string };
type Params = { topic: string; roomId: string; history: Message[] };

export class DebateWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { topic, roomId, history } = event.payload;

    const contextString = history.map(m => `${m.sender}: ${m.text}`).join("\n");
    
    // Helper to talk to the ChatRoom
    const sendToRoom = async (data: any) => {
        const id = this.env.CHAT_ROOM.idFromString(roomId);
        const stub = this.env.CHAT_ROOM.get(id);
        await stub.fetch("http://internal/broadcast", {
            method: "POST",
            body: JSON.stringify(data)
        });
    };

    // --- AGENT A ---
    
    // 1. Send "Typing" signal immediately (Psychological Speed)
    await step.do("signal-a", async () => sendToRoom({ type: "typing", sender: "Agent A" }));

    // 2. Generate Response (Using FAST model)
    const responseA = await step.do("gen-a", async () => {
      const completion = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
            { role: "system", content: `You are Agent A, a witty, passionate, and optimistic debater. 
                          Your Goal: Argue FOR the topic.
                          
                          Style Guidelines:
                          1. Be conversational and punchy.
                          2. Use Markdown.
                          3. Speak entirely in the first person.
                          4. End with a strong, personal concluding sentence.
                          5. Keep it concise.`  },
            { role: "user", content: `Context: ${contextString}\n\nTopic: ${topic}` }
        ]
      }) as any;
      return completion.response || completion;
    });

    // 3. Broadcast Result
    await step.do("post-a", async () => sendToRoom({ sender: "Agent A", text: responseA }));

    // 4. Send "Typing" signal
    await step.do("signal-b", async () => sendToRoom({ type: "typing", sender: "Agent B" }));

    // 5. Generate Response
    const responseB = await step.do("gen-b", async () => {
      const completion = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
            { role: "system", content: `You are Agent B, a skeptical and sharp-witted debater.
                          Your Goal: Refute Agent A and the topic.
                          
                          Style Guidelines:
                          1. Be conversational and punchy.
                          2. Use Markdown.
                          3. Speak entirely in the first person.
                          4. End with a strong, personal concluding sentence.
                          5. Keep it concise.` },
            { role: "user", content: `Agent A said: ${responseA}` }
        ]
      }) as any;
      return completion.response || completion;
    });

    // 6. Broadcast Result
    await step.do("post-b", async () => sendToRoom({ sender: "Agent B", text: responseB }));
  }
}