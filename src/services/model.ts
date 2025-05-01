import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({ 
  model: "o4-mini",
  openAIApiKey: process.env.OPENAI_API_KEY 
});