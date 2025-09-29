import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateImageSchema, type GenerateImageRequest } from "@shared/schema";
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
import { Loader2, Image as ImageIcon, AlertCircle, ChevronDown, Code } from "lucide-react";

// Size options for each model
const MODEL_SIZES = {
  "dall-e-2": ["256x256", "512x512", "1024x1024"],
  "dall-e-3": ["1024x1024", "1024x1792", "1792x1024"],
  "gpt-image-1": ["1024x1024", "1024x1536", "1536x1024", "auto"],
  "gemini-2.5-flash-image-preview": ["1024x1024", "1024x1536", "1536x1024", "auto"]
};

// Quality options for each model
const MODEL_QUALITY = {
  "dall-e-2": [],
  "dall-e-3": ["standard", "hd"],
  "gpt-image-1": ["auto", "high", "medium", "low"],
  "gemini-2.5-flash-image-preview": ["auto", "high", "medium", "low"]
};

interface GenerateTabProps {}

export function GenerateTab({}: GenerateTabProps = {}) {
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const { toast } = useToast();
  const { saveToHistory } = useImageHistory();

  const form = useForm<GenerateImageRequest>({
    resolver: zodResolver(generateImageSchema),
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
    const availableSizes = MODEL_SIZES[watchedModel];
    
    if (!availableSizes.includes(currentSize)) {
      form.setValue("size", availableSizes[0]);
    }

    // Reset n to 1 for dall-e-3
    if (watchedModel === "dall-e-3") {
      form.setValue("n", 1);
    }

    // Clear model-specific fields when switching models
    form.setValue("quality", undefined);
    form.setValue("style", undefined);
    form.setValue("response_format", undefined);
    form.setValue("output_format", undefined);
    form.setValue("output_compression", undefined);
    form.setValue("background", undefined);
    form.setValue("moderation", undefined);
  }, [watchedModel, form]);

  // Clear compression when output format changes
  useEffect(() => {
    if (watchedOutputFormat && !["jpeg", "webp"].includes(watchedOutputFormat)) {
      form.setValue("output_compression", undefined);
    }
  }, [watchedOutputFormat, form]);

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateImageRequest) => {
      try {
        const response = await apiRequest("POST", "/api/generate", data);
        const result = await response.json();
        
        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 401) {
            throw new Error("API key is invalid or expired. Please check your key.");
          } else if (response.status === 400) {
            throw new Error(result.message || "Invalid request parameters. Please check your settings.");
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
        setGeneratedImages(data.imageUrls);
        
        // Save to history
        await saveToHistory(
          data.imageUrls,
          variables.prompt,
          variables.model,
          variables.size,
          'generate',
          variables
        );
        
        toast({
          title: "Success!",
          description: `Generated ${data.imageUrls.length} image${data.imageUrls.length > 1 ? 's' : ''} successfully.`,
        });
      } else {
        throw new Error("No images were generated. Please try again.");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GenerateImageRequest) => {
    generateMutation.mutate(data);
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `generated-image-${index + 1}.png`;
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
    };

    // Add n parameter based on model
    if (values.model === "dall-e-3") {
      requestBody.n = 1;
    } else {
      requestBody.n = values.n;
    }

    // Add optional parameters only if they have values
    if (values.quality) requestBody.quality = values.quality;
    if (values.style) requestBody.style = values.style;
    if (values.response_format) requestBody.response_format = values.response_format;
    if (values.output_format) requestBody.output_format = values.output_format;
    if (values.output_compression !== undefined) requestBody.output_compression = values.output_compression;
    if (values.background) requestBody.background = values.background;
    if (values.moderation) requestBody.moderation = values.moderation;
    if (values.user) requestBody.user = values.user;

    return JSON.stringify(requestBody, null, 2);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Generate Image from Text</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Prompt */}
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe your image</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A serene mountain landscape with a lake at sunset, digital art style..."
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
                        <SelectItem value="gpt-image-1">GPT Image 1 (Recommended)</SelectItem>
                        <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                        <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                        <SelectItem value="gemini-2.5-flash-image-preview">Gemini 2.5 Flash Image (Beta)</SelectItem>
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
                        {MODEL_SIZES[watchedModel].map((size) => (
                          <SelectItem key={size} value={size}>
                            {size === "1024x1792" ? "1024 × 1792 (Portrait)" :
                             size === "1792x1024" ? "1792 × 1024 (Landscape)" :
                             size === "1024x1536" ? "1024 × 1536 (Portrait)" :
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

              {/* Number of Images - Disabled for DALL-E 3 */}
              <FormField
                control={form.control}
                name="n"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Images</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value.toString()}
                      disabled={watchedModel === "dall-e-3"}
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
                    {watchedModel === "dall-e-3" && <p className="text-sm text-slate-500">DALL-E 3 only supports 1 image</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quality - Model specific */}
              {MODEL_QUALITY[watchedModel].length > 0 && (
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
                          {MODEL_QUALITY[watchedModel].map((quality) => (
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

              {/* Style - DALL-E 3 only */}
              {watchedModel === "dall-e-3" && (
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="vivid">Vivid</SelectItem>
                          <SelectItem value="natural">Natural</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Response Format - DALL-E 2 & 3 only */}
              {watchedModel !== "gpt-image-1" && watchedModel !== "gemini-2.5-flash-image-preview" && (
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

              {/* GPT Image 1 & Gemini specific fields */}
              {(watchedModel === "gpt-image-1" || watchedModel === "gemini-2.5-flash-image-preview") && (
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

                  {/* Moderation */}
                  <FormField
                    control={form.control}
                    name="moderation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moderation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select moderation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
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
                disabled={generateMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Generate Image
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

          {generateMutation.isPending && (
            <div className="mt-6 text-center">
              <Loader2 className="w-8 h-8 border-3 border-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">Generating your image...</p>
            </div>
          )}

          {generateMutation.isError && (
            <Alert className="mt-6" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {generateMutation.error?.message || "Failed to generate image. Please check your prompt and try again."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generated Images</CardTitle>
        </CardHeader>
        <CardContent>
          {generatedImages.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" strokeWidth={1} />
              <p className="text-slate-500 dark:text-slate-400">Generated images will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {generatedImages.map((url, index) => (
                <ImageResult
                  key={index}
                  src={url}
                  alt={`Generated image ${index + 1}`}
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
