import { db } from "@/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { murders } from "@/db/models/murders";

export const generateImageForMurder = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      location: true,
    },
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    A crime scene in the style of a retro pixle art video game. The murder, and its victim are described below.

    # Murder
    DESCRIPTION: ${murder?.description}
    LOCATION: ${murder?.location?.description}

    # Victim
    Age: ${murder?.victim?.age}
    Gender: ${murder?.victim?.gender}
    Description: ${murder?.victim?.description}
  `;

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1536x1024",
  });

  fs.mkdirSync(path.join(process.cwd(), "public/story/murders"), {
    recursive: true,
  });

  const image_base64 = result.data?.[0]?.b64_json;
  const image_bytes = Buffer.from(image_base64 ?? "", "base64");
  const filePath = `story/murders/${murder?.id}.png`;
  fs.writeFileSync(path.join(process.cwd(), "public", filePath), image_bytes);

  await db
    .update(murders)
    .set({
      image: filePath,
    })
    .where(eq(murders.id, murderId));
};
