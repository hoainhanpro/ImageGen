import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editImageSchema, type EditImageRequest } from "@shared/schema";
import { type HistoryImage } from "@/lib/imageHistory";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImageResult } from "./image-result";
import { apiRequest } from "@/lib/queryClient";
import { useToast, toast } from "@/hooks/use-toast";
import { useImageHistory } from "@/hooks/use-image-history";
import { Loader2, Edit, Upload, AlertCircle, ChevronDown, Code } from "lucide-react";

// Size options for each model for editing
const EDIT_MODEL_SIZES = {
  "dall-e-2": ["256x256", "512x512", "1024x1024"],
  "gpt-image-1": ["1024x1024", "1024x1536", "1536x1024", "auto"]
};

// Quality options for each model for editing
const EDIT_MODEL_QUALITY = {
  "dall-e-2": [],
  "gpt-image-1": ["auto", "high", "medium", "low"]
};

interface EditTabProps {
  continueEditImage?: HistoryImage | null;
  onContinueEditComplete?: () => void;
}

export function EditTab({ continueEditImage, onContinueEditComplete }: EditTabProps) {
  const [editedImages, setEditedImages] = useState<string[]>([]);
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const { toast } = useToast();
  const { saveToHistory } = useImageHistory();
  const originalInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up object URLs for original files
      originalFiles.forEach(file => {
        URL.revokeObjectURL(URL.createObjectURL(file));
      });
      // Clean up object URL for mask file
      if (maskFile) {
        URL.revokeObjectURL(URL.createObjectURL(maskFile));
      }
    };
  }, [originalFiles, maskFile]);

  const form = useForm<EditImageRequest>({
    resolver: zodResolver(editImageSchema),
    defaultValues: {
      prompt: "",
      model: "gpt-image-1",
      size: "1024x1024",
      n: 1,
    },
  });

  const watchedModel = form.watch("model");
  const watchedOutputFormat = form.watch("output_format");

  // Update size options when model changes
  useEffect(() => {
    const currentSize = form.getValues("size");
    const availableSizes = EDIT_MODEL_SIZES[watchedModel];
    
    if (!availableSizes.includes(currentSize)) {
      form.setValue("size", availableSizes[0]);
    }

    // Clear model-specific fields when switching models
    form.setValue("quality", undefined);
    form.setValue("response_format", undefined);
    form.setValue("output_format", undefined);
    form.setValue("output_compression", undefined);
    form.setValue("background", undefined);
  }, [watchedModel, form]);

  // Clear compression when output format changes
  useEffect(() => {
    if (watchedOutputFormat && !["jpeg", "webp"].includes(watchedOutputFormat)) {
      form.setValue("output_compression", undefined);
    }
  }, [watchedOutputFormat, form]);

  // Handle continue edit from history
  useEffect(() => {
    if (continueEditImage) {
      // Pre-populate the form with the image data
      form.setValue("prompt", continueEditImage.prompt);
      if (continueEditImage.model) {
        form.setValue("model", continueEditImage.model as any);
      }
      if (continueEditImage.size) {
        form.setValue("size", continueEditImage.size);
      }

      // Set the generated image as the original file by converting URL to File
      const loadImageAsFile = async () => {
        try {
          const response = await fetch(continueEditImage.url);
          const blob = await response.blob();
          const file = new File([blob], `continue-edit-${continueEditImage.id}.png`, { type: 'image/png' });
          setOriginalFiles([file]);
        } catch (error) {
          console.error('Failed to load image for continue edit:', error);
          toast({
            title: "Error",
            description: "Failed to load image for editing. Please try again.",
            variant: "destructive",
          });
        }
      };

      loadImageAsFile();
      
      // Call completion callback to clear the continue edit state
      if (onContinueEditComplete) {
        onContinueEditComplete();
      }
    }
  }, [continueEditImage, form, onContinueEditComplete, toast]);

  const editMutation = useMutation({
    mutationFn: async (data: EditImageRequest) => {
      if (!originalFiles || originalFiles.length === 0) {
        throw new Error("At least one original image is required");
      }

      try {
        const formData = new FormData();
        
        // Add all original images
        originalFiles.forEach((file, index) => {
          formData.append(`originalImage${index}`, file);
        });
        
        // Add mask if provided (applies to first image only)
        if (maskFile) {
          formData.append("maskImage", maskFile);
        }
        
        // Append all form data
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, value.toString());
          }
        });

        const response = await fetch("/api/edit", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const result = await response.json();

        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 401) {
            throw new Error("API key is invalid or expired. Please check your key.");
          } else if (response.status === 400) {
            throw new Error(result.message || "Invalid image or parameters. Please check your files and settings.");
          } else if (response.status === 429) {
            throw new Error("Rate limit exceeded. Please wait a moment and try again.");
          } else if (response.status === 500) {
            throw new Error("Server error occurred. Please try again in a moment.");
          } else {
            throw new Error(result.message || `Request failed with status ${response.status}`);
          }
        }

        return result;
      } catch (error: any) {
        // Handle network errors and other exceptions
        if (error.message) {
          throw error;
        } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
          throw new Error("Network error. Please check your connection and try again.");
        } else {
          throw new Error("An unexpected error occurred. Please try again.");
        }
      }
    },
    onSuccess: async (data, variables) => {
      if (data.imageUrls && data.imageUrls.length > 0) {
        setEditedImages(data.imageUrls);
        
        // Save to history with input images
        const historyParameters = {
          ...variables,
          originalImages: originalFiles?.map(file => URL.createObjectURL(file)) || [],
          maskImage: maskFile ? URL.createObjectURL(maskFile) : undefined,
        };
        
        await saveToHistory(
          data.imageUrls,
          variables.prompt,
          variables.model,
          variables.size,
          'edit',
          historyParameters
        );
        
        toast({
          title: "Success!",
          description: `Edited ${data.imageUrls.length} image${data.imageUrls.length > 1 ? 's' : ''} successfully.`,
        });
      } else {
        throw new Error("No images were generated. Please try again.");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Edit Failed",
        description: error.message || "Failed to edit image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditImageRequest) => {
    editMutation.mutate(data);
  };

  const handleFileUpload = (files: FileList | File[], type: 'original' | 'mask') => {
    const currentModel = form.getValues("model");
    
    if (type === 'original') {
      const fileArray = Array.from(files);
      
      // Validate number of files based on model
      if (currentModel === 'dall-e-2' && fileArray.length > 1) {
        toast({
          title: "Too many files",
          description: "DALL-E 2 only supports editing one image at a time.",
          variant: "destructive",
        });
        return;
      }
      
      if (currentModel === 'gpt-image-1' && fileArray.length > 16) {
        toast({
          title: "Too many files",
          description: "GPT Image 1 supports up to 16 images maximum.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file types and sizes
      for (const file of fileArray) {
        // For DALL-E 2: only PNG, square, <4MB
        if (currentModel === 'dall-e-2') {
          if (file.type !== 'image/png') {
            toast({
              title: "Invalid file type",
              description: "DALL-E 2 requires PNG images only.",
              variant: "destructive",
            });
            return;
          }
          if (file.size > 4 * 1024 * 1024) { // 4MB
            toast({
              title: "File too large",
              description: "DALL-E 2 images must be under 4MB.",
              variant: "destructive",
            });
            return;
          }
        }
        
        // For GPT Image 1: PNG/WEBP/JPG, <50MB each
        if (currentModel === 'gpt-image-1') {
          if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
            toast({
              title: "Invalid file type",
              description: "GPT Image 1 supports PNG, WEBP, or JPEG images only.",
              variant: "destructive",
            });
            return;
          }
          if (file.size > 50 * 1024 * 1024) { // 50MB
            toast({
              title: "File too large",
              description: "GPT Image 1 images must be under 50MB each.",
              variant: "destructive",
            });
            return;
          }
        }
      }
      
      setOriginalFiles(fileArray);
    } else {
      // Mask handling (single file only)
      const file = Array.from(files)[0];
      
      // Validate file type - PNG is strongly recommended for masks
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Mask must be an image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (4MB limit for masks)
      if (file.size > 4 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Mask image must be under 4MB.",
          variant: "destructive",
        });
        return;
      }
      
      // Provide guidance about mask requirements
      if (file.type !== 'image/png') {
        toast({
          title: "PNG recommended",
          description: "PNG format with transparency is recommended for best mask results.",
          variant: "default",
        });
      }
      
      setMaskFile(file);
    }
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `edited-image-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  // Get the current form values for JSON preview
  const getRequestBodyPreview = () => {
    const values = form.getValues();
    const requestBody: any = {
      prompt: values.prompt,
      model: values.model,
      size: values.size,
      n: values.n,
    };

    // Add optional parameters only if they have values
    if (values.quality) requestBody.quality = values.quality;
    if (values.response_format) requestBody.response_format = values.response_format;
    if (values.output_format) requestBody.output_format = values.output_format;
    if (values.output_compression !== undefined) requestBody.output_compression = values.output_compression;
    if (values.background) requestBody.background = values.background;
    if (values.user) requestBody.user = values.user;

    // Add file info
    if (originalFiles && originalFiles.length > 0) {
      requestBody.images = originalFiles.map(file => `${file.name} (${file.size} bytes)`);
    }
    if (maskFile) requestBody.mask = `${maskFile.name} (${maskFile.size} bytes)`;

    return JSON.stringify(requestBody, null, 2);
  };

  const removeFile = (type: 'original' | 'mask', index?: number) => {
    if (type === 'original' && index !== undefined) {
      const newFiles = originalFiles.filter((_, i) => i !== index);
      setOriginalFiles(newFiles);
      // Reset the input value
      if (originalInputRef.current) {
        originalInputRef.current.value = '';
      }
    } else if (type === 'mask') {
      setMaskFile(null);
      // Reset the input value
      if (maskInputRef.current) {
        maskInputRef.current.value = '';
      }
    }
  };

  const UploadArea = ({ 
    title, 
    description, 
    onClick, 
    file, 
    files,
    type,
    required = false
  }: { 
    title: string; 
    description: string; 
    onClick: () => void; 
    file?: File | null;
    files?: File[] | null;
    type: 'original' | 'mask';
    required?: boolean;
  }) => {
    const hasFiles = (files && files.length > 0) || file;
    
    return (
      <div>
        <FormLabel>{title} {required && "*"}</FormLabel>
        
        {/* Show image previews if files are uploaded */}
        {hasFiles && (
          <div className="mb-4">
            {type === 'original' && files && files.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {files.map((uploadedFile, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(uploadedFile)}
                      alt={`Original image ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('original', index);
                        URL.revokeObjectURL(URL.createObjectURL(uploadedFile));
                      }}
                      className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      ✕
                    </button>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                      {uploadedFile.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {type === 'mask' && file && (
              <div className="relative inline-block group">
                <img
                  src={URL.createObjectURL(file)}
                  alt="Mask image"
                  className="w-32 h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile('mask');
                    URL.revokeObjectURL(URL.createObjectURL(file));
                  }}
                  className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove mask"
                >
                  ✕
                </button>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-32">
                  {file.name}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Upload area */}
        <div 
          className="upload-area border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          onClick={onClick}
        >
          <Upload className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            {hasFiles 
              ? `${files?.length || 1} file${(files?.length || 1) > 1 ? 's' : ''} uploaded • Click to change`
              : "Click to upload or drag and drop"
            }
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{description}</p>
        </div>
        
        <input
          ref={type === 'original' ? originalInputRef : maskInputRef}
          type="file"
          accept={type === 'original' ? (watchedModel === 'gpt-image-1' ? ".png,.webp,.jpeg,.jpg" : ".png") : ".png,.jpg,.jpeg"}
          multiple={type === 'original' && watchedModel === 'gpt-image-1'}
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) handleFileUpload(files, type);
          }}
        />
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Edit Image with Mask</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* File Uploads */}
              <UploadArea
                title={watchedModel === 'gpt-image-1' ? "Original Images (Up to 16)" : "Original Image (PNG)"}
                description={watchedModel === 'gpt-image-1' ? "PNG, WEBP, JPEG files. Up to 16 images, 50MB each" : "PNG files only, square, <4MB"}
                onClick={() => originalInputRef.current?.click()}
                files={originalFiles}
                type="original"
                required={true}
              />

              <UploadArea
                title={`Mask Image (Optional)${watchedModel === 'gpt-image-1' ? ' - Limited Support' : ''}`}
                description={watchedModel === 'gpt-image-1' 
                  ? "Note: GPT Image 1 has limited mask support. PNG with transparency recommended."
                  : "PNG with transparency recommended. Black/transparent areas will be edited, white areas stay unchanged."
                }
                onClick={() => maskInputRef.current?.click()}
                file={maskFile}
                type="mask"
              />

              {/* Prompt */}
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe the changes *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Replace the sky with a dramatic sunset..."
                        className="resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model Selection */}
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                        <SelectItem value="gpt-image-1">GPT Image 1</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Size Selection - Dynamic based on model */}
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Size</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EDIT_MODEL_SIZES[watchedModel].map((size) => (
                          <SelectItem key={size} value={size}>
                            {size === "1024x1536" ? "1024 × 1536 (Portrait)" :
                             size === "1536x1024" ? "1536 × 1024 (Landscape)" :
                             size === "auto" ? "Auto" :
                             size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Number of Images */}
              <FormField
                control={form.control}
                name="n"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Images</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} Image{num > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quality - Model specific */}
              {EDIT_MODEL_QUALITY[watchedModel].length > 0 && (
                <FormField
                  control={form.control}
                  name="quality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select quality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EDIT_MODEL_QUALITY[watchedModel].map((quality) => (
                            <SelectItem key={quality} value={quality}>
                              {quality.charAt(0).toUpperCase() + quality.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Response Format - DALL-E 2 only */}
              {watchedModel === "dall-e-2" && (
                <FormField
                  control={form.control}
                  name="response_format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Format</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select response format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="url">URL</SelectItem>
                          <SelectItem value="b64_json">Base64 JSON</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* GPT Image 1 specific fields */}
              {watchedModel === "gpt-image-1" && (
                <>
                  {/* Output Format */}
                  <FormField
                    control={form.control}
                    name="output_format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Output Format</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select output format" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="png">PNG</SelectItem>
                            <SelectItem value="jpeg">JPEG</SelectItem>
                            <SelectItem value="webp">WebP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Output Compression - Only for JPEG/WebP */}
                  {watchedOutputFormat && ["jpeg", "webp"].includes(watchedOutputFormat) && (
                    <FormField
                      control={form.control}
                      name="output_compression"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Output Compression (0-100)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="80"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Background */}
                  <FormField
                    control={form.control}
                    name="background"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Background</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select background" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="transparent">Transparent</SelectItem>
                            <SelectItem value="opaque">Opaque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* User field - Optional for all models */}
              <FormField
                control={form.control}
                name="user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Custom identifier for abuse tracking"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={editMutation.isPending || !originalFiles || originalFiles.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {editMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Edit className="w-5 h-5 mr-2" />
                    Edit Image
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* JSON Preview */}
          <Collapsible open={showJsonPreview} onOpenChange={setShowJsonPreview} className="mt-6">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <Code className="w-4 h-4 mr-2" />
                {showJsonPreview ? "Hide" : "Show"} API Request Body
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showJsonPreview ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-sm overflow-auto max-h-60">
                {getRequestBodyPreview()}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {editMutation.isPending && (
            <div className="mt-6 text-center">
              <Loader2 className="w-8 h-8 border-3 border-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">Editing your image...</p>
            </div>
          )}

          {editMutation.isError && (
            <Alert className="mt-6" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {editMutation.error?.message || "Failed to edit image. Please check your files and prompt."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edited Results</CardTitle>
        </CardHeader>
        <CardContent>
          {editedImages.length === 0 ? (
            <div className="text-center py-12">
              <Edit className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" strokeWidth={1} />
              <p className="text-slate-500 dark:text-slate-400">Edited images will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {editedImages.map((url, index) => (
                <ImageResult
                  key={index}
                  src={url}
                  alt={`Edited image ${index + 1}`}
                  onDownload={() => downloadImage(url, index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
