import { clues, cluesRelations } from "./models/clues";
import { clueLinks, clueLinksRelations } from "./models/clueLink";
import { locations } from "./models/location";
import { messages, messagesRelations } from "./models/messages";
import { murders, murdersRelations } from "./models/murders";
import { people, peopleRelations } from "./models/people";

export const schema = {
  people,
  peopleRelations,
  locations,
  murders,
  murdersRelations,
  clues,
  cluesRelations,
  clueLinks,
  clueLinksRelations,
  messages,
  messagesRelations,
};
