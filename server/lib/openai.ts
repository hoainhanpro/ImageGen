import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function generateImage(params: {
  prompt: string;
  model: "dall-e-2" | "dall-e-3" | "gpt-image-1";
  size: string;
  n: number;
  quality?: "standard" | "hd" | "auto" | "high" | "medium" | "low";
  style?: "vivid" | "natural";
  response_format?: "url" | "b64_json";
  output_format?: "png" | "jpeg" | "webp";
  output_compression?: number;
  background?: "auto" | "transparent" | "opaque";
  moderation?: "auto" | "low";
  user?: string;
}, apiKey: string): Promise<string[]> {
  try {
    // Create OpenAI client with provided API key
    const clientOpenai = new OpenAI({ apiKey });

    // Build the request object dynamically based on the model
    const requestBody: any = {
      model: params.model,
      prompt: params.prompt,
      size: params.size,
    };

    // Handle n parameter - dall-e-3 only supports n=1
    if (params.model === "dall-e-3") {
      requestBody.n = 1;
    } else {
      requestBody.n = params.n;
    }

    // Add model-specific parameters
    if (params.model === "dall-e-3") {
      if (params.quality && ["standard", "hd"].includes(params.quality)) {
        requestBody.quality = params.quality;
      }
      if (params.style) {
        requestBody.style = params.style;
      }
    }

    if (params.model === "gpt-image-1") {
      if (params.quality && ["auto", "high", "medium", "low"].includes(params.quality)) {
        requestBody.quality = params.quality;
      }
      if (params.output_format) {
        requestBody.output_format = params.output_format;
      }
      if (params.output_compression !== undefined) {
        requestBody.output_compression = params.output_compression;
      }
      if (params.background) {
        requestBody.background = params.background;
      }
      if (params.moderation) {
        requestBody.moderation = params.moderation;
      }
    }

    // Common parameters for dall-e-2 and dall-e-3
    if (params.model !== "gpt-image-1" && params.response_format) {
      requestBody.response_format = params.response_format;
    }

    if (params.user) {
      requestBody.user = params.user;
    }

    const response = await clientOpenai.images.generate(requestBody);

    // Handle both URL and base64 responses
    return response.data?.map(image => {
      if (image.url) {
        return image.url;
      } else if (image.b64_json) {
        // Return base64 data with proper data URL format
        return `data:image/png;base64,${image.b64_json}`;
      }
      throw new Error("Invalid response format from OpenAI API");
    }) || [];
  } catch (error) {
    throw new Error(`Failed to generate image: ${(error as Error).message}`);
  }
}

export async function editImage(
  imageFiles: Buffer[], 
  maskFile: Buffer | null, 
  params: {
    prompt: string;
    model: "dall-e-2" | "gpt-image-1";
    size: string;
    n: number;
    quality?: "standard" | "high" | "medium" | "low" | "auto";
    response_format?: "url" | "b64_json";
    output_format?: "png" | "jpeg" | "webp";
    output_compression?: number;
    background?: "auto" | "transparent" | "opaque";
    user?: string;
  }, 
  apiKey: string
): Promise<string[]> {
  try {
    // Create OpenAI client with provided API key
    const clientOpenai = new OpenAI({ apiKey });

    // For DALL-E 2, only use the first image (single image editing)
    // For GPT Image 1, can use multiple images
    // Convert buffers to File objects that OpenAI SDK can handle
    const imageFiles_converted = imageFiles.map((buffer, index) => {
      const mimeType = buffer.toString('hex').startsWith('89504e47') ? 'image/png' : 
                      buffer.toString('hex').startsWith('ffd8ffe') ? 'image/jpeg' : 'image/webp';
      
      // Create a File-like object for OpenAI SDK
      return new File([buffer], `image${index}.${mimeType.split('/')[1]}`, { type: mimeType });
    });
    
    const maskFile_converted = maskFile ? (() => {
      // OpenAI API requires masks to be PNG format with alpha channel
      // Force PNG type regardless of original format for API compatibility
      return new File([maskFile], 'mask.png', { type: 'image/png' });
    })() : undefined;

    // Build the request object dynamically based on the model
    const requestBody: any = {
      prompt: params.prompt,
      model: params.model,
      size: params.size,
      n: params.n,
    };

    // For DALL-E 2: single image editing with mask support
    if (params.model === 'dall-e-2') {
      requestBody.image = imageFiles_converted[0] as any;
      
      // Add mask if provided (DALL-E 2 supports masks)
      if (maskFile_converted) {
        requestBody.mask = maskFile_converted as any;
        console.log('DALL-E 2 - Mask file details:', {
          name: maskFile_converted.name,
          type: maskFile_converted.type,
          size: maskFile_converted.size
        });
      }
    } else {
      // For GPT Image 1: multiple images support
      requestBody.image = imageFiles_converted.length === 1 ? imageFiles_converted[0] as any : imageFiles_converted as any;
      
      // GPT Image 1 may have different mask requirements
      if (maskFile_converted) {
        console.log('GPT Image 1 - Mask file details:', {
          name: maskFile_converted.name,
          type: maskFile_converted.type,
          size: maskFile_converted.size
        });
        // Only add mask for GPT Image 1 if it's properly formatted
        requestBody.mask = maskFile_converted as any;
      }
    }

    // Add model-specific parameters
    if (params.model === "gpt-image-1") {
      if (params.quality && ["auto", "high", "medium", "low"].includes(params.quality)) {
        requestBody.quality = params.quality;
      }
      if (params.output_format) {
        requestBody.output_format = params.output_format;
      }
      if (params.output_compression !== undefined) {
        requestBody.output_compression = params.output_compression;
      }
      if (params.background) {
        requestBody.background = params.background;
      }
    }

    // Response format for dall-e-2 only
    if (params.model === "dall-e-2" && params.response_format) {
      requestBody.response_format = params.response_format;
    }

    if (params.user) {
      requestBody.user = params.user;
    }

    const response = await clientOpenai.images.edit(requestBody);

    // Handle both URL and base64 responses
    return response.data?.map(image => {
      if (image.url) {
        return image.url;
      } else if (image.b64_json) {
        // Return base64 data with proper data URL format
        return `data:image/png;base64,${image.b64_json}`;
      }
      throw new Error("Invalid response format from OpenAI API");
    }) || [];
  } catch (error) {
    throw new Error(`Failed to edit image: ${(error as Error).message}`);
  }
}

export async function createImageVariations(
  imageFile: Buffer, 
  params: {
    n: number;
    size: "256x256" | "512x512" | "1024x1024";
    response_format: "url" | "b64_json";
    user?: string;
  }, 
  apiKey: string
): Promise<string[]> {
  try {
    // Create OpenAI client with provided API key
    const clientOpenai = new OpenAI({ apiKey });

    // Convert buffer to File-like object
    const imageBlob = new Blob([imageFile], { type: 'image/png' });

    // Build the request object
    const requestBody: any = {
      image: imageBlob as any,
      n: params.n,
      size: params.size,
      response_format: params.response_format,
    };

    if (params.user) {
      requestBody.user = params.user;
    }

    const response = await clientOpenai.images.createVariation(requestBody);

    // Handle both URL and base64 responses
    return response.data?.map(image => {
      if (image.url) {
        return image.url;
      } else if (image.b64_json) {
        // Return base64 data with proper data URL format
        return `data:image/png;base64,${image.b64_json}`;
      }
      throw new Error("Invalid response format from OpenAI API");
    }) || [];
  } catch (error) {
    throw new Error(`Failed to create image variations: ${(error as Error).message}`);
  }
}
