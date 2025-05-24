import { messageSuspect } from "@/services/messages";

export async function POST(req: Request) {
  const { message, suspectId } = await req.json();

  const stream = await messageSuspect(suspectId, message);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
