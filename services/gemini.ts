
import { GoogleGenAI } from "@google/genai";

export const generateProductDescription = async (
  name: string,
  application: string,
  category: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Descrição automática indisponível (API Key não configurada).";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `
      Crie uma descrição técnica e comercial persuasiva para uma peça automotiva em um catálogo.
      
      Dados da peça:
      Nome: ${name}
      Aplicação (Veículos e Motorização): ${application}
      Categoria: ${category}
      
      A descrição deve focar em compatibilidade, durabilidade e desempenho. Máximo de 2 parágrafos.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a descrição.";
  } catch (error) {
    console.error("Erro ao gerar descrição com Gemini:", error);
    return "Erro ao comunicar com o assistente de IA.";
  }
};
