import { z } from "zod";

export const generateImageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  model: z.enum(["dall-e-2", "dall-e-3", "gpt-image-1", "gemini-2.5-flash-image-preview"]).default("dall-e-2"),
  size: z.string().default("512x512"),
  n: z.number().min(1).max(10).default(1),
  quality: z.enum(["standard", "hd", "auto", "high", "medium", "low"]).optional(),
  style: z.enum(["vivid", "natural"]).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  output_format: z.enum(["png", "jpeg", "webp"]).optional(),
  output_compression: z.number().min(0).max(100).optional(),
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  moderation: z.enum(["auto", "low"]).optional(),
  user: z.string().optional(),
});

export const editImageSchema = z.object({
  prompt: z.string().min(1, "Edit prompt is required"),
  model: z.enum(["dall-e-2", "gpt-image-1"]).default("dall-e-2"),
  size: z.string().default("1024x1024"),
  n: z.number().min(1).max(10).default(1),
  quality: z.enum(["standard", "high", "medium", "low", "auto"]).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  output_format: z.enum(["png", "jpeg", "webp"]).optional(),
  output_compression: z.number().min(0).max(100).optional(),
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  user: z.string().optional(),
});

export const createVariationsSchema = z.object({
  n: z.number().min(1).max(10).default(1),
  size: z.enum(["256x256", "512x512", "1024x1024"]).default("1024x1024"),
  response_format: z.enum(["url", "b64_json"]).default("url"),
  user: z.string().optional(),
});

export const flowerGenerationSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  variables: z.record(z.string()),
  model: z.enum(["dall-e-2", "dall-e-3", "gpt-image-1", "gemini-2.5-flash-image-preview"]).default("dall-e-2"),
  size: z.string().default("1024x1024"),
  n: z.number().min(1).max(10).default(1),
  quality: z.enum(["standard", "hd", "auto", "high", "medium", "low"]).optional(),
  style: z.enum(["vivid", "natural"]).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  output_format: z.enum(["png", "jpeg", "webp"]).optional(),
  output_compression: z.number().min(0).max(100).optional(),
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  moderation: z.enum(["auto", "low"]).optional(),
  user: z.string().optional(),
  referenceImages: z.array(z.string()).optional(), // Google Drive file IDs
});

export const batchFlowerItemSchema = z.object({
  referenceImageId: z.string().min(1, "Reference image ID is required"),
  variables: z.record(z.string()),
});

export const batchFlowerGenerationSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  items: z.array(batchFlowerItemSchema).min(1, "At least one item is required"),
  model: z.enum(["dall-e-2", "dall-e-3", "gpt-image-1", "gemini-2.5-flash-image-preview"]).default("dall-e-2"),
  size: z.string().default("1024x1024"),
  n: z.number().min(1).max(10).default(1),
  quality: z.enum(["standard", "hd", "auto", "high", "medium", "low"]).optional(),
  style: z.enum(["vivid", "natural"]).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  output_format: z.enum(["png", "jpeg", "webp"]).optional(),
  output_compression: z.number().min(0).max(100).optional(),
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  moderation: z.enum(["auto", "low"]).optional(),
  user: z.string().optional(),
});

export const batchFlowerResultSchema = z.object({
  referenceImageId: z.string(),
  variables: z.record(z.string()),
  processedPrompt: z.string(),
  imageUrls: z.array(z.string()),
  error: z.string().optional(),
});

export const driveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  webViewLink: z.string().optional(),
  thumbnailLink: z.string().optional(),
  size: z.string().optional(),
  parents: z.array(z.string()).optional(),
});

export const driveFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  webViewLink: z.string().optional(),
  parents: z.array(z.string()).optional(),
});

export const driveAuthSchema = z.object({
  code: z.string(),
});

export type GenerateImageRequest = z.infer<typeof generateImageSchema>;
export type EditImageRequest = z.infer<typeof editImageSchema>;
export type CreateVariationsRequest = z.infer<typeof createVariationsSchema>;
export type FlowerGenerationRequest = z.infer<typeof flowerGenerationSchema>;
export type BatchFlowerItem = z.infer<typeof batchFlowerItemSchema>;
export type BatchFlowerGenerationRequest = z.infer<typeof batchFlowerGenerationSchema>;
export type BatchFlowerResult = z.infer<typeof batchFlowerResultSchema>;
export type DriveFile = z.infer<typeof driveFileSchema>;
export type DriveFolder = z.infer<typeof driveFolderSchema>;
export type DriveAuthRequest = z.infer<typeof driveAuthSchema>;
