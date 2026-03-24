import { readFileSync } from "fs";
import { join } from "path";
import { createAddClueLinkTool } from "./add-clue-link";
import { createCreateClueTool } from "./create-clue";
import { createCreateMurderSceneTool } from "./create-murder-scene";
import { createCreatePersonTool } from "./create-person";
import { createGetChainStateTool } from "./get-chain-state";
import { createMarkClueVisibleTool } from "./mark-clue-visible";
import { createSetClueLinkVisibleTool } from "./set-clue-link-visible";
import { createSetVictimAndPerpetratorTool } from "./set-victim-and-perpetrator";
import { createUpdateClueDescriptionTool } from "./update-clue-description";
import { createUpdateClueLinkPersonTool } from "./update-clue-link-person";
import { createUpdateClueRelationTool } from "./update-clue-relation";
import { createUpdatePersonMotiveTool } from "./update-person-motive";

export const SYSTEM_PROMPT = readFileSync(
  join(__dirname, "..", "prompts", "system.md"),
  "utf-8",
);

const CREATE_PERSON_FIX_DESCRIPTION =
  "Create a new person. Only use when the fix genuinely requires a new intermediate suspect or red herring (e.g. to extend chain depth or add a dead-end branch). Returns personId.";
const CREATE_CLUE_FIX_DESCRIPTION =
  "Create a new clue with links to people. Only use when the fix requires adding a bridge clue or dead-end clue that doesn't exist yet.";

/**
 * Builds the tool set for the murder generation agent and a getter for the
 * murder ID (set when create_murder_scene runs). Used by generateMurder.
 *
 * @returns Object with tools array and getMurderId function
 */
export const buildTools = () => {
  let murderId: number | null = null;

  const getMurderId = () => {
    if (!murderId) throw new Error("Murder scene not created yet");
    return murderId;
  };

  const setMurderId = (id: number) => {
    murderId = id;
  };

  const tools = [
    createCreateMurderSceneTool(setMurderId),
    createCreatePersonTool(getMurderId),
    createSetVictimAndPerpetratorTool(getMurderId),
    createCreateClueTool(getMurderId),
    createMarkClueVisibleTool(),
  ];

  return { tools, getMurderId };
};

/**
 * Returns the tool set for chain and narrative fix agents. Includes chain
 * state inspection, clue/link updates, and person/clue creation for fixes.
 *
 * @param murderId - The murder being fixed
 * @returns Array of fix tools
 */
export const getFixTools = (murderId: number) => [
  createGetChainStateTool(murderId),
  createSetClueLinkVisibleTool(),
  createUpdateClueDescriptionTool(),
  createUpdateClueRelationTool(),
  createUpdateClueLinkPersonTool(),
  createAddClueLinkTool(murderId),
  createCreatePersonTool(() => murderId, {
    toolDescription: CREATE_PERSON_FIX_DESCRIPTION,
    logPrefix: "Fix",
  }),
  createCreateClueTool(() => murderId, {
    toolDescription: CREATE_CLUE_FIX_DESCRIPTION,
    logPrefix: "Fix",
  }),
  createUpdatePersonMotiveTool(),
];
