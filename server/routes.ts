import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  generateImageSchema,
  editImageSchema,
  createVariationsSchema,
  flowerGenerationSchema,
  batchFlowerGenerationSchema,
  driveAuthSchema,
} from "@shared/schema";
import { generateImage, editImage, createImageVariations } from "./lib/openai";
import { createGeminiService } from "./lib/gemini";
import { driveService } from "./lib/drive";
import { FLOWER_TEMPLATES, processTemplate } from "@shared/templates";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.fieldname === "originalImage" ||
      file.fieldname === "variationImage" ||
      file.fieldname.startsWith("originalImage")
    ) {
      // For original images with numbered fieldnames (originalImage0, originalImage1, etc.)
      // Allow PNG, WEBP, JPEG for gpt-image-1, PNG only for dall-e-2
      if (file.fieldname.startsWith("originalImage") && file.fieldname !== "originalImage") {
        // This is for edit endpoint with multiple images - allow more formats
        if (['image/png', 'image/webp', 'image/jpeg'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Only PNG, WEBP, and JPEG files are allowed for edit images"));
        }
      } else {
        // Original single image logic for variations and legacy - PNG only
        if (file.mimetype === "image/png") {
          cb(null, true);
        } else {
          cb(
            new Error(
              "Only PNG files are allowed for original and variation images",
            ),
          );
        }
      }
    } else if (file.fieldname === "maskImage") {
      // Allow PNG, JPG, JPEG for mask images
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed for masks"));
      }
    } else {
      cb(new Error("Unexpected field"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate image from text prompt
  app.post("/api/generate", async (req, res) => {
    try {
      const generationData = req.body;
      const validatedData = generateImageSchema.parse(generationData);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !apiKey.startsWith("sk-")) {
        return res
          .status(500)
          .json({ message: "OpenAI API key not configured on server" });
      }

      // Filter out Gemini model for standard generation
      if (validatedData.model === "gemini-2.5-flash-image-preview") {
        return res
          .status(400)
          .json({ message: "Gemini model is only available for flower generation" });
      }

      const openaiData = {
        ...validatedData,
        model: validatedData.model as "dall-e-2" | "dall-e-3" | "gpt-image-1"
      };

      const imageUrls = await generateImage(openaiData, apiKey);
      res.json({ imageUrls });
    } catch (error) {
      console.error("Generate image error:", error);
      res.status(500).json({
        message:
          (error as Error).message ||
          "Failed to generate image. Please check your prompt and try again.",
      });
    }
  });

  // Generate flower image with template
  app.post("/api/flower-generate", async (req, res) => {
    try {
      const flowerData = req.body;
      const validatedData = flowerGenerationSchema.parse(flowerData);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !apiKey.startsWith("sk-")) {
        return res
          .status(500)
          .json({ message: "OpenAI API key not configured on server" });
      }

      // Find the template
      const template = FLOWER_TEMPLATES.find(t => t.id === validatedData.templateId);
      if (!template) {
        return res
          .status(400)
          .json({ message: "Invalid template ID" });
      }

      // Process the template with variables
      const processedPrompt = processTemplate(template, validatedData.variables);

      let imageUrls: string[];

      if (validatedData.model === "gemini-2.5-flash-image-preview") {
        // Handle Gemini model
        if (!process.env.GEMINI_API_KEY) {
          return res
            .status(500)
            .json({ message: "Gemini API key not configured on server" });
        }

        const geminiService = createGeminiService(process.env.GEMINI_API_KEY);
        
        // For now, use Gemini to enhance the prompt then generate with OpenAI
        const enhancedPrompt = await geminiService.generateImageDescription(processedPrompt);
        
        // Fall back to OpenAI for actual generation
        const { templateId, variables, referenceImages, ...baseFields } = validatedData;
        const openaiData = {
          ...baseFields,
          prompt: enhancedPrompt,
          model: "gpt-image-1" as const
        };
        
        imageUrls = await generateImage(openaiData, apiKey);
      } else {
        // Use OpenAI models - filter out non-OpenAI fields
        const { templateId, variables, referenceImages, model, ...openaiFields } = validatedData;
        const openaiData = {
          ...openaiFields,
          model: model as "dall-e-2" | "dall-e-3" | "gpt-image-1",
          prompt: processedPrompt
        };
        
        imageUrls = await generateImage(openaiData, apiKey);
      }

      res.json({ imageUrls });
    } catch (error) {
      console.error("Flower generation error:", error);
      res.status(500).json({
        message:
          (error as Error).message ||
          "Failed to generate flower image. Please check your settings and try again.",
      });
    }
  });

  // Batch generate flower images with template
  app.post("/api/batch-flower-generate", async (req, res) => {
    try {
      const batchData = req.body;
      const validatedData = batchFlowerGenerationSchema.parse(batchData);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !apiKey.startsWith("sk-")) {
        return res
          .status(500)
          .json({ message: "OpenAI API key not configured on server" });
      }

      // Find the template
      const template = FLOWER_TEMPLATES.find(t => t.id === validatedData.templateId);
      if (!template) {
        return res
          .status(400)
          .json({ message: "Invalid template ID" });
      }

      // Process all items in parallel
      const processGenerationTask = async (item: any) => {
        try {
          // Process the template with variables for this item
          const processedPrompt = processTemplate(template, item.variables);

          let imageUrls: string[];

          if (validatedData.model === "gemini-2.5-flash-image-preview") {
            // Handle Gemini model
            if (!process.env.GEMINI_API_KEY) {
              throw new Error("Gemini API key not configured on server");
            }

            const geminiService = createGeminiService(process.env.GEMINI_API_KEY);
            
            // Use Gemini to enhance the prompt then generate with OpenAI
            const enhancedPrompt = await geminiService.generateImageDescription(processedPrompt);
            
            // Fall back to OpenAI for actual generation
            const { items, templateId, ...baseFields } = validatedData;
            const openaiData = {
              ...baseFields,
              prompt: enhancedPrompt,
              model: "gpt-image-1" as const
            };
            
            imageUrls = await generateImage(openaiData, apiKey);
          } else {
            // Use OpenAI models - filter out non-OpenAI fields
            const { items, templateId, model, ...openaiFields } = validatedData;
            const openaiData = {
              ...openaiFields,
              model: model as "dall-e-2" | "dall-e-3" | "gpt-image-1",
              prompt: processedPrompt
            };
            
            imageUrls = await generateImage(openaiData, apiKey);
          }

          return {
            referenceImageId: item.referenceImageId,
            variables: item.variables,
            processedPrompt,
            imageUrls
          };
        } catch (error) {
          console.error(`Error generating for item ${item.referenceImageId}:`, error);
          return {
            referenceImageId: item.referenceImageId,
            variables: item.variables,
            processedPrompt: processTemplate(template, item.variables),
            imageUrls: [],
            error: (error as Error).message || "Failed to generate image"
          };
        }
      };

      // Execute all generation tasks in parallel
      const results = await Promise.all(
        validatedData.items.map(processGenerationTask)
      );

      res.json({ results });
    } catch (error) {
      console.error("Batch flower generation error:", error);
      res.status(500).json({
        message:
          (error as Error).message ||
          "Failed to generate batch flower images. Please check your settings and try again.",
      });
    }
  });

  // Edit image with mask
  app.post(
    "/api/edit",
    upload.fields([
      { name: "originalImage0", maxCount: 1 },
      { name: "originalImage1", maxCount: 1 },
      { name: "originalImage2", maxCount: 1 },
      { name: "originalImage3", maxCount: 1 },
      { name: "originalImage4", maxCount: 1 },
      { name: "originalImage5", maxCount: 1 },
      { name: "originalImage6", maxCount: 1 },
      { name: "originalImage7", maxCount: 1 },
      { name: "originalImage8", maxCount: 1 },
      { name: "originalImage9", maxCount: 1 },
      { name: "originalImage10", maxCount: 1 },
      { name: "originalImage11", maxCount: 1 },
      { name: "originalImage12", maxCount: 1 },
      { name: "originalImage13", maxCount: 1 },
      { name: "originalImage14", maxCount: 1 },
      { name: "originalImage15", maxCount: 1 },
      { name: "maskImage", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const editData = req.body;
        
        // Transform string form data to proper types
        const transformedData = {
          ...editData,
          n: editData.n ? parseInt(editData.n, 10) : 1,
          size: editData.size || "1024x1024"
        };
        
        const validatedData = editImageSchema.parse(transformedData);
        const files = req.files as { [fieldname: string]: any[] };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || !apiKey.startsWith("sk-")) {
          return res
            .status(500)
            .json({ message: "OpenAI API key not configured on server" });
        }

        // Collect all uploaded original images
        const originalImageBuffers: Buffer[] = [];
        for (let i = 0; i < 16; i++) {
          const fieldName = `originalImage${i}`;
          if (files[fieldName] && files[fieldName][0]) {
            originalImageBuffers.push(files[fieldName][0].buffer);
          }
        }

        if (originalImageBuffers.length === 0) {
          return res
            .status(400)
            .json({ message: "At least one original image is required" });
        }

        const maskImageBuffer =
          files.maskImage && files.maskImage[0]
            ? files.maskImage[0].buffer
            : null;

        const editedImageUrls = await editImage(
          originalImageBuffers,
          maskImageBuffer,
          validatedData,
          apiKey,
        );

        res.json({ imageUrls: editedImageUrls });
      } catch (error) {
        console.error("Edit image error:", error);
        res.status(500).json({
          message:
            (error as Error).message ||
            "Failed to edit image. Please check your files and prompt.",
        });
      }
    },
  );

  // Create image variations
  app.post(
    "/api/variations",
    upload.single("variationImage"),
    async (req, res) => {
      try {
        const variationData = req.body;
        
        // Transform string form data to proper types
        const transformedData = {
          ...variationData,
          n: variationData.n ? parseInt(variationData.n, 10) : 1,
          size: variationData.size || "1024x1024"
        };
        
        const validatedData = createVariationsSchema.parse(transformedData);

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || !apiKey.startsWith("sk-")) {
          return res
            .status(500)
            .json({ message: "OpenAI API key not configured on server" });
        }

        if (!(req as any).file) {
          return res.status(400).json({ message: "Image file is required" });
        }

        const imageBuffer = (req as any).file.buffer;
        const variationUrls = await createImageVariations(
          imageBuffer,
          validatedData,
          apiKey,
        );

        res.json({ imageUrls: variationUrls });
      } catch (error) {
        console.error("Create variations error:", error);
        res.status(500).json({
          message:
            (error as Error).message ||
            "Failed to create image variations. Please check your image file.",
        });
      }
    },
  );


  // Google Drive authentication and file management routes
  app.get("/api/drive/auth-url", async (req, res) => {
    try {
      // Debug environment variables
      console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✓ Present" : "✗ Missing");
      console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✓ Present" : "✗ Missing");
      console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);
      
      const authUrl = driveService.getAuthUrl();
      console.log("Generated Auth URL:", authUrl);
      
      // Force no cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json({ authUrl, timestamp: Date.now() });
    } catch (error) {
      console.error("Drive auth URL error:", error);
      res.status(500).json({ message: "Failed to get Drive auth URL" });
    }
  });

  app.post("/api/drive/auth", async (req, res) => {
    try {
      const { code } = driveAuthSchema.parse(req.body);
      const tokens = await driveService.getAccessToken(code);
      
      // In production, you should store tokens securely (e.g., in session or database)
      // For now, we'll just return them to the client
      res.json({ tokens, message: "Successfully authenticated with Google Drive" });
    } catch (error) {
      console.error("Drive auth error:", error);
      res.status(500).json({ message: "Failed to authenticate with Google Drive" });
    }
  });

  app.post("/api/drive/refresh", async (req, res) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ message: "Refresh token is required" });
      }
      
      const tokens = await driveService.refreshTokens(refresh_token);
      res.json({ tokens, message: "Successfully refreshed Drive tokens" });
    } catch (error) {
      console.error("Drive token refresh error:", error);
      res.status(500).json({ message: "Failed to refresh Drive tokens" });
    }
  });

  app.get("/api/drive/files", async (req, res) => {
    try {
      const { tokens, folderId, query } = req.query;
      
      console.log("Drive files request:", { 
        folderId: folderId || "none", 
        query: query || "none",
        hasTokens: !!tokens 
      });
      
      if (!tokens) {
        return res.status(401).json({ message: "Drive authentication tokens required" });
      }

      // Set credentials from query params (in production, get from secure storage)
      const parsedTokens = JSON.parse(tokens as string);
      driveService.setCredentials(parsedTokens);
      
      const structure = await driveService.getFilesAndFoldersStructure(folderId as string, query as string);
      console.log("Drive structure result:", { 
        folderId: folderId || "none",
        foldersCount: structure.folders.length,
        filesCount: structure.files.length,
        currentFolder: structure.currentFolder?.name || "root",
        breadcrumbsLength: structure.breadcrumbs.length
      });
      
      res.json(structure);
    } catch (error) {
      console.error("Drive list files error:", error);
      res.status(500).json({ message: "Failed to list Drive files" });
    }
  });

  app.get("/api/drive/file/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const { tokens } = req.query;
      
      if (!tokens) {
        return res.status(401).json({ message: "Drive authentication tokens required" });
      }

      const parsedTokens = JSON.parse(tokens as string);
      driveService.setCredentials(parsedTokens);
      
      const fileBuffer = await driveService.getFile(fileId);
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': fileBuffer.length,
      });
      res.send(fileBuffer);
    } catch (error) {
      console.error("Drive get file error:", error);
      res.status(500).json({ message: "Failed to get Drive file" });
    }
  });

  app.post("/api/drive/upload-image", async (req, res) => {
    try {
      const { imageUrl, fileName, folderId, tokens } = req.body;
      
      if (!tokens) {
        return res.status(401).json({ message: "Drive authentication tokens required" });
      }

      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }

      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }

      const parsedTokens = JSON.parse(tokens);
      driveService.setCredentials(parsedTokens);
      
      const fileId = await driveService.uploadImageFromUrl(imageUrl, fileName, folderId);
      
      res.json({ 
        success: true, 
        fileId, 
        message: "Image uploaded to Drive successfully" 
      });
    } catch (error) {
      console.error("Drive upload image error:", error);
      res.status(500).json({ 
        message: "Failed to upload image to Drive",
        error: (error as Error).message 
      });
    }
  });

  app.post("/api/drive/create-folder", async (req, res) => {
    try {
      const { name, parentFolderId, tokens } = req.body;
      
      if (!tokens) {
        return res.status(401).json({ message: "Drive authentication tokens required" });
      }

      if (!name) {
        return res.status(400).json({ message: "Folder name is required" });
      }

      const parsedTokens = JSON.parse(tokens);
      driveService.setCredentials(parsedTokens);
      
      const folderId = await driveService.createFolder(name, parentFolderId);
      
      res.json({ 
        success: true, 
        folderId, 
        message: "Folder created successfully" 
      });
    } catch (error) {
      console.error("Drive create folder error:", error);
      res.status(500).json({ 
        message: "Failed to create folder",
        error: (error as Error).message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
