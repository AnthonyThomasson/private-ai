import { db } from "@/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import { people } from "@/db/models/people";
import path from "path";
import OpenAI from "openai";

export const generateImageForPerson = async (
  personId: number,
  isDead?: boolean,
) => {
  const person = await db.query.people.findFirst({
    where: eq(people.id, personId),
    with: {
      location: true,
    },
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let prompt = `
    A headshot photograph in the style of a retro pixle art video game. The character in 
    the photograph is described below, and the location should be represented in the background.

    Gender: ${person?.gender}
    Age: ${person?.age}
    Description: ${person?.description}
    Location: ${person?.location?.description}
  `;
  if (isDead ?? false) {
    prompt = `
    A polariod headshot photograph pinned to a bulletin board in the style of a retro pixle art video game. The 
    character in the photograph is described below.

    Gender: ${person?.gender}
    Age: ${person?.age}
    Description: ${person?.description}
  `;
  }

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  fs.mkdirSync(path.join(process.cwd(), "public/story/characters"), {
    recursive: true,
  });

  const image_base64 = result.data?.[0]?.b64_json;
  const image_bytes = Buffer.from(image_base64 ?? "", "base64");
  const filePath = `story/characters/${person?.id}.png`;
  fs.writeFileSync(path.join(process.cwd(), "public", filePath), image_bytes);

  await db
    .update(people)
    .set({
      image: filePath,
    })
    .where(eq(people.id, personId));
};
