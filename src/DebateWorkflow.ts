import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

type Params = {topic: string; roomId: string};

export class DebateWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { topic, roomId } = event.payload;
  
    // Agent A (Optimisitic Debater)
    const responseA = await step.do("agent-a-speaks", async () => {
      const completion = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: [
          { role: "system", content: "You are an optimistic debater. Keep it short."},
          { role: "user", content: `Give an arguemnt FOR: ${topic}` }
        ]
      });
      return (completion as any).response;
    }); 
    
    // Post Agent A's response back to Durable Object
    await step.do("post-a", async () => {
      const id = this.env.CHAT_ROOM.idFromString(roomId);
      const stub = this.env.CHAT_ROOM.get(id);
      await stub.fetch("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify({ sender: "Agent A", text: responseA })
      });
    });

    // Pause before Agent B responses, could include typing bubble UI
    await step.sleep("wait-for-read", "2 seconds");

    // Post Agent B's (Skeptic Debater) respone to Agent A
    const responseB = await step.do("agent-b-speaks", async () => {
      const completion = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: [
            { role: "system", content: "You are a skeptical debater. Keep it short." },
            { role: "user", content: `Refute this argument regarding ${topic}: ${responseA}` }
        ]
      });
      return (completion as any).response;
    });

    // Post Agent B's response back to Durable Object
    await step.do("post-b", async () => {
        const id = this.env.CHAT_ROOM.idFromString(roomId);
        const stub = this.env.CHAT_ROOM.get(id);
        await stub.fetch("http://internal/broadcast", {
            method: "POST",
            body: JSON.stringify({ sender: "Agent B", text: responseB })
        });
    });
  }
}