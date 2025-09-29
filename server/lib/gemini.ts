import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateImage(prompt: string, options: {
    size?: string;
    quality?: string;
    style?: string;
    outputFormat?: string;
    outputCompression?: number;
    background?: string;
    moderation?: string;
    referenceImages?: Buffer[];
  } = {}): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-image-preview" 
      });

      // Prepare the request
      const parts: any[] = [{ text: prompt }];
      
      // Add reference images if provided
      if (options.referenceImages && options.referenceImages.length > 0) {
        for (const imageBuffer of options.referenceImages) {
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: imageBuffer.toString('base64')
            }
          });
        }
      }

      // Generate image with Gemini
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: parts
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        },
      });

      const response = await result.response;
      const text = response.text();
      
      // Note: Gemini doesn't directly generate images like DALL-E
      // This is a placeholder implementation
      // In practice, you might need to use a different approach
      // or combine with other image generation services
      
      throw new Error("Gemini image generation not yet fully implemented. Please use OpenAI models for now.");
      
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw new Error(`Gemini generation failed: ${(error as Error).message}`);
    }
  }

  // Alternative approach using text-to-image description
  async generateImageDescription(prompt: string, options: {
    referenceImages?: Buffer[];
  } = {}): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
      });

      const parts: any[] = [
        { 
          text: `Create a detailed image generation prompt based on this request: ${prompt}. 
          Include specific details about composition, lighting, colors, style, and technical specifications.
          Make it suitable for DALL-E or similar image generation models.` 
        }
      ];
      
      // Add reference images for context if provided
      if (options.referenceImages && options.referenceImages.length > 0) {
        parts.unshift({ text: "Use these reference images as style guides:" });
        for (const imageBuffer of options.referenceImages) {
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: imageBuffer.toString('base64')
            }
          });
        }
      }

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: parts
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        },
      });

      const response = await result.response;
      return response.text();
      
    } catch (error) {
      console.error('Gemini description generation error:', error);
      throw new Error(`Gemini description generation failed: ${(error as Error).message}`);
    }
  }
}

export function createGeminiService(apiKey: string): GeminiService {
  return new GeminiService(apiKey);
}
