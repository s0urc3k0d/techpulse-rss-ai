/**
 * AI Provider abstraction - supports both Gemini and Mistral
 * Allows easy switching between AI providers via environment variable
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Mistral } from '@mistralai/mistralai';

export type AIProvider = 'gemini' | 'mistral';

interface AIResponse {
  text: string;
}

interface AIProviderConfig {
  provider: AIProvider;
  model: string;
}

// Get current provider configuration
export const getProviderConfig = (): AIProviderConfig => {
  const provider = (process.env.AI_PROVIDER || 'mistral').toLowerCase() as AIProvider;
  
  if (provider === 'gemini') {
    return {
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    };
  }
  
  return {
    provider: 'mistral',
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest'
  };
};

// Get API key based on provider
export const getApiKey = (provider: AIProvider): string => {
  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');
    return key;
  }
  
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('MISTRAL_API_KEY is not configured');
  return key;
};

// Categories enum matching frontend
export const Category = {
  HARDWARE: "Hardware",
  GAMING: "Jeux Vidéo",
  AI: "IA & Data",
  SOFTWARE: "Software & Apps",
  SECURITY: "Cybersécurité",
  BUSINESS: "Business Tech",
  MOBILE: "Mobile & Telecom",
  SCIENCE: "Science & Espace",
  OTHER: "Autre"
} as const;

export type CategoryType = typeof Category[keyof typeof Category];

/**
 * Categorize articles using AI
 */
export const categorizeWithAI = async (
  articles: Array<{ id: string; title: string; description: string }>
): Promise<Array<{ id: string; category: CategoryType }>> => {
  const config = getProviderConfig();
  const apiKey = getApiKey(config.provider);

  const prompt = `You are a tech news aggregator assistant. 
Analyze the following list of tech news articles.
Assign exactly one category to each article from the following list:
[Hardware, Jeux Vidéo, IA & Data, Software & Apps, Cybersécurité, Business Tech, Mobile & Telecom, Science & Espace, Autre].

Return a JSON object with this exact structure:
{
  "classifications": [
    { "id": "article_id", "category": "category_name" },
    ...
  ]
}

Articles to categorize:
${JSON.stringify(articles, null, 2)}`;

  if (config.provider === 'gemini') {
    return categorizeWithGemini(apiKey, config.model, articles, prompt);
  } else {
    return categorizeWithMistral(apiKey, config.model, articles, prompt);
  }
};

/**
 * Generate podcast script using AI
 */
export const generateScriptWithAI = async (
  articles: Array<{ id: string; title: string; description: string; source: string }>
): Promise<Array<{ originalId: string; catchyTitle: string; keyPoints: string[] }>> => {
  const config = getProviderConfig();
  const apiKey = getApiKey(config.provider);

  const prompt = `You are a professional Tech Podcast Host. 
I will provide a list of news articles. 
For EACH article, I need two things in French (Français):
1. A "Catchy Title" (Titre accrocheur) that sounds great when spoken, to introduce the topic.
2. A list of 3-4 "Key Points" (Points clés) summarizing the essential information for the listener.

Return a JSON object with this exact structure:
{
  "scriptItems": [
    {
      "originalId": "article_id",
      "catchyTitle": "Catchy title in French",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    },
    ...
  ]
}

Articles to process:
${JSON.stringify(articles, null, 2)}`;

  if (config.provider === 'gemini') {
    return generateScriptWithGemini(apiKey, config.model, prompt);
  } else {
    return generateScriptWithMistral(apiKey, config.model, prompt);
  }
};

// ============ GEMINI IMPLEMENTATION ============

const categorizeWithGemini = async (
  apiKey: string,
  model: string,
  articles: Array<{ id: string; title: string; description: string }>,
  prompt: string
): Promise<Array<{ id: string; category: CategoryType }>> => {
  const ai = new GoogleGenAI({ apiKey });

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

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema,
    }
  });

  const resultText = response.text;
  if (!resultText) throw new Error('No response from Gemini');

  const parsed = JSON.parse(resultText);
  return parsed.classifications || [];
};

const generateScriptWithGemini = async (
  apiKey: string,
  model: string,
  prompt: string
): Promise<Array<{ originalId: string; catchyTitle: string; keyPoints: string[] }>> => {
  const ai = new GoogleGenAI({ apiKey });

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      scriptItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalId: { type: Type.STRING },
            catchyTitle: { type: Type.STRING },
            keyPoints: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            }
          },
          required: ["originalId", "catchyTitle", "keyPoints"]
        }
      }
    },
    required: ["scriptItems"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema,
    }
  });

  const resultText = response.text;
  if (!resultText) throw new Error('No response from Gemini');

  const parsed = JSON.parse(resultText);
  return parsed.scriptItems || [];
};

// ============ MISTRAL IMPLEMENTATION ============

const categorizeWithMistral = async (
  apiKey: string,
  model: string,
  articles: Array<{ id: string; title: string; description: string }>,
  prompt: string
): Promise<Array<{ id: string; category: CategoryType }>> => {
  const client = new Mistral({ apiKey });

  const response = await client.chat.complete({
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    responseFormat: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('No response from Mistral');
  }

  const parsed = JSON.parse(content);
  return parsed.classifications || [];
};

const generateScriptWithMistral = async (
  apiKey: string,
  model: string,
  prompt: string
): Promise<Array<{ originalId: string; catchyTitle: string; keyPoints: string[] }>> => {
  const client = new Mistral({ apiKey });

  const response = await client.chat.complete({
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    responseFormat: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('No response from Mistral');
  }

  const parsed = JSON.parse(content);
  return parsed.scriptItems || [];
};

/**
 * Simple categorization for scheduler (batch processing)
 */
export const categorizeForScheduler = async (
  articles: Array<{ title: string; source: string }>
): Promise<Array<{ category: string }>> => {
  const config = getProviderConfig();
  const apiKey = getApiKey(config.provider);

  const schedulerCategories = Object.values(Category);
  const normalizeCategory = (value: string): string => {
    return schedulerCategories.includes(value as CategoryType) ? value : Category.OTHER;
  };

  const prompt = `Categorize these tech articles into one of these categories: ${schedulerCategories.join(', ')}.

${articles.map((a, idx) => `${idx + 1}. ${a.title}`).join('\n')}

Return ONLY a JSON array with category for each article: [{"category":"..."}, ...]`;

  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: config.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    const text = result.text?.replace(/```json\n?|```/g, '').trim();
    if (!text) throw new Error('No response from Gemini');
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed) ? parsed : (parsed.categories || parsed.classifications || []);
    return entries.map((entry: any) => ({
      category: normalizeCategory(entry?.category || Category.OTHER)
    }));
  } else {
    const client = new Mistral({ apiKey });
    const response = await client.chat.complete({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('No response from Mistral');
    }

    // Mistral returns object, need to handle both array and object with array
    const parsed = JSON.parse(content);
    const entries = Array.isArray(parsed) ? parsed : (parsed.categories || parsed.classifications || []);
    return entries.map((entry: any) => ({
      category: normalizeCategory(entry?.category || Category.OTHER)
    }));
  }
};

// Export provider info for logging
export const getProviderInfo = (): string => {
  const config = getProviderConfig();
  return `${config.provider.toUpperCase()} (${config.model})`;
};
