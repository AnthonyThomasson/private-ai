import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { and, not, eq } from "drizzle-orm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "fs";
import path from "path";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getTools } from "./tools";
import { generatePersonFromDescription } from "../person/person";
import { people } from "@/db/models/people";
import { clueLinks } from "@/db/models/clueLink";

export const generateCluesFromMurder = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  await generatePersonFromDescription(
    murderId,
    `The perpetrator of the murder: 
    
    ${JSON.stringify(murder.description)}`,
  );

  const perpetrator = await db.query.people.findFirst({
    where: and(
      eq(people.murderId, murderId),
      not(eq(people.id, murder.victimId ?? 0)),
    ),
  });
  await db.update(murders).set({
    perpetratorId: perpetrator?.id,
  });

  await generatClues(
    murderId,
    `Create ${Math.floor(Math.random() * 3) + 2} clues leading to additional information. They could include possible witnesses, suspects, or forensic evidence that lead to more information about the murder. The clues should not incriminate the individules tied to them, but should be leads to possibly more information about the murder. The clues should not be reported by the people they are tied to, they should be the result of a investigation leading to them for more information.`,
  );

  await db
    .update(clueLinks)
    .set({
      isVisible: 1,
    })
    .where(eq(clueLinks.murderId, murderId));

  await generatClues(
    murderId,
    `generate ${Math.floor(Math.random() * 6) + 3} rumors and false leads about the murder. The leads need to be able to be revealed through the interrogation of suspects, and not by any physical investigation. Include these leads should be linked to multiple clues that verify the leads are false.`,
  );

  await generatClues(
    murderId,
    `generate ${Math.floor(Math.random() * 3) + 2} multiple coherent clues incriminating the perpetrator. The clues NEED to be retrievable through the interrogation of the perpetrator or other suspects, and not by any physical investigation. Clues should should be connected to some existing suspects so that uncovering them is possible.:
    
      ${JSON.stringify(perpetrator)}`,
  );
};

export const generatClues = async (murderId: number, direction: string) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      clueLinks: {
        with: {
          clue: true,
          person: true,
        },
      },
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  const { createClue, createPerson, linkPersonToClue } = getTools(murder.id);

  const promptTemplate = ChatPromptTemplate.fromMessages([
    [
      "system",
      fs.readFileSync(
        path.join(
          process.cwd(),
          "src/services/agents/story/clueNEW/prompt",
          "generator.md",
        ),
        "utf8",
      ),
    ],
    ["human", "{directions}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    directions: direction,
    murder_details: murder.description,
    victim: JSON.stringify(murder.victim),
    existing_clues: JSON.stringify(murder.clueLinks),
    constraints: fs.readFileSync(
      path.join(
        process.cwd(),
        "src/services/agents/story/clueNEW/prompt",
        "constraints.md",
      ),
      "utf8",
    ),
    create_clue: "create_clue",
    create_person: "create_person",
    link_person_to_clue: "link_person_to_clue",
  });

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "o4-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [createClue, createPerson, linkPersonToClue],
  });

  await agent.invoke({ messages: formattedPrompt }, { recursionLimit: 200 });
};
