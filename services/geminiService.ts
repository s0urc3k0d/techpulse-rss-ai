import { GoogleGenAI, Type } from "@google/genai";
import { RSSItem, ProcessedArticle, Category, PodcastScriptItem } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const categorizeArticles = async (
  articles: RSSItem[]
): Promise<ProcessedArticle[]> => {
  const ai = getClient();
  
  if (articles.length === 0) return [];

  // Generate unique IDs for mapping
  const articlesWithId = articles.map((a, index) => ({
    ...a,
    id: `art_${index}`
  }));

  // Prepare prompt content - Minimal data to save tokens
  const simplifiedArticles = articlesWithId.map(a => ({
    id: a.id,
    title: a.title,
    // Truncate description to avoid hitting token limits if many articles
    description: a.description.substring(0, 150) 
  }));

  const prompt = `
    You are a tech news aggregator assistant. 
    Analyze the following list of tech news articles.
    Assign exactly one category to each article from the following list:
    [Hardware, Jeux Vidéo, IA & Data, Software & Apps, Cybersécurité, Business Tech, Mobile & Telecom, Science & Espace, Autre].
    
    Return a JSON object where the key is the article ID and the value is the category.
  `;

  // Schema for structured output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      classifications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              enum: Object.values(Category)
            },
          },
          required: ["id", "category"]
        }
      }
    },
    required: ["classifications"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: JSON.stringify(simplifiedArticles) }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini");

    const parsedResult = JSON.parse(resultText);
    const classificationMap = new Map<string, Category>();

    if (parsedResult.classifications) {
      parsedResult.classifications.forEach((item: any) => {
        classificationMap.set(item.id, item.category as Category);
      });
    }

    // Merge results
    return articlesWithId.map(article => ({
      ...article,
      category: classificationMap.get(article.id) || Category.OTHER
    }));

  } catch (error) {
    console.error("Gemini classification failed:", error);
    // Fallback: mark all as Other if AI fails
    return articlesWithId.map(a => ({ ...a, category: Category.OTHER }));
  }
};

export const generatePodcastScript = async (
  articles: ProcessedArticle[]
): Promise<PodcastScriptItem[]> => {
  const ai = getClient();

  if (articles.length === 0) return [];

  // Prepare prompt content
  const contentToAnalyze = articles.map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    source: a.source
  }));

  const prompt = `
    You are a professional Tech Podcast Host. 
    I will provide a list of news articles. 
    For EACH article, I need two things in French (Français):
    1. A "Catchy Title" (Titre accrocheur) that sounds great when spoken, to introduce the topic.
    2. A list of 3-4 "Key Points" (Points clés) summarizing the essential information for the listener.
    
    Output strictly valid JSON.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      scriptItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalId: { type: Type.STRING },
            catchyTitle: { type: Type.STRING, description: "A catchy hook title in French for a podcast" },
            keyPoints: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3-4 bullet points summarizing the article in French"
            }
          },
          required: ["originalId", "catchyTitle", "keyPoints"]
        }
      }
    },
    required: ["scriptItems"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: JSON.stringify(contentToAnalyze) }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini");

    const parsed = JSON.parse(resultText);
    return parsed.scriptItems || [];

  } catch (error) {
    console.error("Podcast script generation failed:", error);
    return [];
  }
};
