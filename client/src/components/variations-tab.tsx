import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createVariationsSchema, type CreateVariationsRequest } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageResult } from "./image-result";
import { useToast, toast } from "@/hooks/use-toast";
import { useImageHistory } from "@/hooks/use-image-history";
import { Loader2, RotateCcw, Upload, AlertCircle } from "lucide-react";

// Helper function to validate image file
function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'image/png') {
    return { isValid: false, error: 'Image must be a PNG file' };
  }

  // Check file size (4MB limit)
  const maxSize = 4 * 1024 * 1024; // 4MB in bytes
  if (file.size > maxSize) {
    return { isValid: false, error: 'Image must be less than 4MB' };
  }

  return { isValid: true };
}

// Helper function to check if image is square (will be called after image loads)
function validateImageDimensions(file: File): Promise<{ isValid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width !== img.height) {
        resolve({ isValid: false, error: 'Image must have square dimensions (e.g., 1024x1024)' });
      } else {
        resolve({ isValid: true });
      }
    };
    img.onerror = () => {
      resolve({ isValid: false, error: 'Invalid image file' });
    };
    img.src = URL.createObjectURL(file);
  });
}

interface VariationsTabProps {}

export function VariationsTab({}: VariationsTabProps = {}) {
  const [variationImages, setVariationImages] = useState<string[]>([]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { saveToHistory } = useImageHistory();

  const form = useForm<CreateVariationsRequest>({
    resolver: zodResolver(createVariationsSchema),
    defaultValues: {
      n: 1,
      size: "1024x1024",
      response_format: "url",
    },
  });

  const variationsMutation = useMutation({
    mutationFn: async (data: CreateVariationsRequest) => {
      if (!sourceFile) {
        throw new Error("Source image is required");
      }

      try {
        const formData = new FormData();
        formData.append("variationImage", sourceFile);
        
        // Append all form data
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, value.toString());
          }
        });

        const response = await fetch("/api/variations", {
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
            throw new Error(result.message || "Invalid image or parameters. Please ensure your image is PNG, square, and under 4MB.");
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
        setVariationImages(data.imageUrls);
        
        // Save to history with source image filename as prompt
        const prompt = sourceFile ? `Variations of: ${sourceFile.name}` : 'Image variations';
        const historyParameters = {
          ...variables,
          originalImages: sourceFile ? [URL.createObjectURL(sourceFile)] : [],
        };
        
        await saveToHistory(
          data.imageUrls,
          prompt,
          'dall-e-2', // Variations only work with dall-e-2
          variables.size,
          'variation',
          historyParameters
        );
        
        toast({
          title: "Success!",
          description: `Created ${data.imageUrls.length} variation${data.imageUrls.length > 1 ? 's' : ''} successfully.`,
        });
      } else {
        throw new Error("No variations were generated. Please try again.");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Variations Failed",
        description: error.message || "Failed to create variations. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateVariationsRequest) => {
    variationsMutation.mutate(data);
  };

  const handleFileUpload = async (file: File) => {
    setFileValidationError(null);
    
    // Basic validation first
    const basicValidation = validateImageFile(file);
    if (!basicValidation.isValid) {
      setFileValidationError(basicValidation.error!);
      return;
    }

    // Validate dimensions
    const dimensionValidation = await validateImageDimensions(file);
    if (!dimensionValidation.isValid) {
      setFileValidationError(dimensionValidation.error!);
      return;
    }

    setSourceFile(file);
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `variation-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create Image Variations</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* File Upload */}
              <div>
                <FormLabel>Source Image (PNG) *</FormLabel>
                <div 
                  className="upload-area border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium">
                    {sourceFile ? sourceFile.name : "Click to upload image"}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">PNG, square dimensions, less than 4MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                {fileValidationError && (
                  <Alert className="mt-2" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileValidationError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Number of Variations */}
              <FormField
                control={form.control}
                name="n"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Variations</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} Variation{num > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Size Selection */}
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
                        <SelectItem value="256x256">256 × 256</SelectItem>
                        <SelectItem value="512x512">512 × 512</SelectItem>
                        <SelectItem value="1024x1024">1024 × 1024</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Response Format */}
              <FormField
                control={form.control}
                name="response_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

              {/* User field - Optional */}
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
                disabled={variationsMutation.isPending || !sourceFile}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {variationsMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Create Variations
                  </>
                )}
              </Button>
            </form>
          </Form>

          {variationsMutation.isPending && (
            <div className="mt-6 text-center">
              <Loader2 className="w-8 h-8 border-3 border-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">Creating variations...</p>
            </div>
          )}

          {variationsMutation.isError && (
            <Alert className="mt-6" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {variationsMutation.error?.message || "Failed to create variations. Please check your image file."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Image Variations</CardTitle>
        </CardHeader>
        <CardContent>
          {variationImages.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" strokeWidth={1} />
              <p className="text-slate-500 dark:text-slate-400">Image variations will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {variationImages.map((url, index) => (
                <ImageResult
                  key={index}
                  src={url}
                  alt={`Variation ${index + 1}`}
                  onDownload={() => downloadImage(url, index)}
                  className="aspect-square"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
