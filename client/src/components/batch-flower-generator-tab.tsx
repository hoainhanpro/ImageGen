import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FLOWER_TEMPLATES, processTemplate } from "@shared/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ImageResult } from "./image-result";
import { DriveImageBrowser } from "./drive-image-browser";
import { useDriveAuth } from "@/contexts/drive-auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flower, AlertCircle, Plus, Trash2, Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";

interface BatchItem {
  id: string;
  referenceImageId: string;
  variables: Record<string, string>;
  customPrompt: string;
  status: "pending" | "processing" | "completed" | "error";
}

interface BatchResult {
  referenceImageId: string;
  variables: Record<string, string>;
  processedPrompt: string;
  imageUrls: string[];
  error?: string;
}

export function BatchFlowerGeneratorTab() {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("single-branch");
  const [model, setModel] = useState("gpt-image-1");
  const [size, setSize] = useState("1024x1024");
  const [numImages, setNumImages] = useState(1);
  const [quality, setQuality] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<string | undefined>(undefined);
  const [responseFormat, setResponseFormat] = useState<string | undefined>("url");
  const [outputFormat, setOutputFormat] = useState<string | undefined>(undefined);
  const [outputCompression, setOutputCompression] = useState<number | undefined>(undefined);
  const [background, setBackground] = useState<string | undefined>(undefined);
  const [moderation, setModeration] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<string | undefined>(undefined);
  const { tokens } = useDriveAuth();
  const { toast } = useToast();

  const selectedTemplate = FLOWER_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Get image URL for Drive preview
  const getImageUrl = (fileId: string) => {
    if (!tokens || !fileId) return "";
    const params = new URLSearchParams({
      tokens: JSON.stringify(tokens),
    });
    return `/api/drive/file/${fileId}?${params}`;
  };

  const addBatchItem = () => {
    if (!selectedTemplate) return;

    const newItem: BatchItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      referenceImageId: "",
      variables: selectedTemplate.variables.reduce((acc, variable) => {
        acc[variable.name] = variable.defaultValue;
        return acc;
      }, {} as Record<string, string>),
      customPrompt: "",
      status: "pending"
    };

    setBatchItems(prev => [...prev, newItem]);
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const updateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const updateItemVariable = (itemId: string, variableName: string, value: string) => {
    setBatchItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            variables: { ...item.variables, [variableName]: value } 
          }
        : item
    ));
  };

  const updateItemCustomPrompt = (itemId: string, customPrompt: string) => {
    setBatchItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, customPrompt }
        : item
    ));
  };

  // Get final prompt for an item (custom prompt has priority over template)
  const getFinalPrompt = (item: BatchItem): string => {
    if (item.customPrompt.trim()) {
      return item.customPrompt;
    }
    return selectedTemplate ? processTemplate(selectedTemplate, item.variables) : "";
  };

  const batchGenerateMutation = useMutation({
    mutationFn: async (data: any) => {
      setIsGenerating(true);
      setOverallProgress(0);

      try {
        const response = await apiRequest("POST", "/api/batch-flower-generate", data);
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || `Request failed with status ${response.status}`);
        }
        
        return result;
      } catch (error: any) {
        throw new Error(error.message || "An unexpected error occurred. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (data: { results: BatchResult[] }) => {
      setResults(data.results);
      setOverallProgress(100);

      // Update batch items status
      setBatchItems(prev => prev.map(item => {
        const result = data.results.find(r => r.referenceImageId === item.referenceImageId);
        return {
          ...item,
          status: result?.error ? "error" : "completed"
        };
      }));

      const successCount = data.results.filter(r => !r.error).length;
      const errorCount = data.results.filter(r => r.error).length;
      
      toast({
        title: "Batch Generation Complete! 🌸",
        description: `Generated ${successCount} successful results. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
      });
    },
    onError: (error: any) => {
      setIsGenerating(false);
      setOverallProgress(0);
      
      // Reset all items to pending
      setBatchItems(prev => prev.map(item => ({ ...item, status: "pending" as const })));
      
      toast({
        title: "Batch Generation Failed",
        description: error.message || "Failed to generate flower images. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = () => {
    // Validate all items have reference images
    const invalidItems = batchItems.filter(item => !item.referenceImageId);
    if (invalidItems.length > 0) {
      toast({
        title: "Missing Reference Images",
        description: `Please select reference images for all ${invalidItems.length} items.`,
        variant: "destructive",
      });
      return;
    }

    const batchData: any = {
      templateId: selectedTemplateId,
      model: model,
      size: size,
      n: numImages,
      items: batchItems.map(item => ({
        referenceImageId: item.referenceImageId,
        variables: item.variables,
        customPrompt: item.customPrompt,
        finalPrompt: getFinalPrompt(item)
      }))
    };

    // Add optional parameters if they are set
    if (quality) batchData.quality = quality;
    if (style) batchData.style = style;
    if (responseFormat) batchData.response_format = responseFormat;
    if (outputFormat) batchData.output_format = outputFormat;
    if (outputCompression !== undefined) batchData.output_compression = outputCompression;
    if (background) batchData.background = background;
    if (moderation) batchData.moderation = moderation;
    if (user) batchData.user = user;

    // Set all items to processing
    setBatchItems(prev => prev.map(item => ({ ...item, status: "processing" as const })));
    
    batchGenerateMutation.mutate(batchData);
  };

  const downloadAllImages = async () => {
    for (const result of results) {
      if (result.imageUrls && result.imageUrls.length > 0) {
        for (let i = 0; i < result.imageUrls.length; i++) {
          try {
            const response = await fetch(result.imageUrls[i]);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `batch-flower-${result.referenceImageId}-${i + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            // Small delay to prevent browser from blocking downloads
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error("Failed to download image:", error);
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Flower className="w-5 h-5" />
            Batch Flower Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Template Selection */}
            <div>
              <Label>Flower Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLOWER_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div>
              <Label>AI Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-image-1">GPT Image 1</SelectItem>
                  <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                  <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                  <SelectItem value="gemini-2.5-flash-image-preview">Gemini 2.5 Flash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Size Selection */}
            <div>
              <Label>Image Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">1024 × 1024</SelectItem>
                  <SelectItem value="1024x1536">1024 × 1536 (Portrait)</SelectItem>
                  <SelectItem value="1536x1024">1536 × 1024 (Landscape)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number of Images per item */}
            <div>
              <Label>Images per Reference</Label>
              <Select 
                value={numImages.toString()} 
                onValueChange={(value) => setNumImages(parseInt(value))}
                disabled={model === "dall-e-3"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} Image{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {model === "dall-e-3" && <p className="text-xs text-slate-500">DALL-E 3 only supports 1 image</p>}
            </div>

            {/* Quality - Model specific */}
            {(model === "dall-e-3" || model === "gpt-image-1" || model === "gemini-2.5-flash-image-preview") && (
              <div>
                <Label>Quality</Label>
                <Select value={quality || ""} onValueChange={(value) => setQuality(value || undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {model === "dall-e-3" && (
                      <>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="hd">HD</SelectItem>
                      </>
                    )}
                    {(model === "gpt-image-1" || model === "gemini-2.5-flash-image-preview") && (
                      <>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Style - DALL-E 3 only */}
            {model === "dall-e-3" && (
              <div>
                <Label>Style</Label>
                <Select value={style || ""} onValueChange={(value) => setStyle(value || undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vivid">Vivid - Hyper-real and dramatic</SelectItem>
                    <SelectItem value="natural">Natural - More natural looking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Response Format */}
            <div>
              <Label>Response Format</Label>
              <Select value={responseFormat || "url"} onValueChange={(value) => setResponseFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="url">URL - Link to image</SelectItem>
                  <SelectItem value="b64_json">Base64 - Embedded data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output Format */}
            <div>
              <Label>Output Format</Label>
              <Select value={outputFormat || ""} onValueChange={(value) => setOutputFormat(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG - Lossless quality</SelectItem>
                  <SelectItem value="jpeg">JPEG - Smaller file size</SelectItem>
                  <SelectItem value="webp">WebP - Modern format</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output Compression - Only for JPEG and WebP */}
            {(outputFormat === "jpeg" || outputFormat === "webp") && (
              <div>
                <Label>Output Compression (0-100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="80"
                  value={outputCompression || ""}
                  onChange={(e) => setOutputCompression(e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <p className="text-xs text-slate-500">Higher = better quality, lower = smaller file</p>
              </div>
            )}

            {/* Background */}
            <div>
              <Label>Background</Label>
              <Select value={background || ""} onValueChange={(value) => setBackground(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select background" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto - Model decides</SelectItem>
                  <SelectItem value="transparent">Transparent - PNG only</SelectItem>
                  <SelectItem value="opaque">Opaque - Solid background</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content Moderation */}
            <div>
              <Label>Content Moderation</Label>
              <Select value={moderation || ""} onValueChange={(value) => setModeration(value || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select moderation level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto - Standard filtering</SelectItem>
                  <SelectItem value="low">Low - Minimal filtering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User ID (Optional) */}
            <div>
              <Label>User ID (Tùy chọn)</Label>
              <Input
                placeholder="Nhập user ID cho tracking"
                value={user || ""}
                onChange={(e) => setUser(e.target.value || undefined)}
              />
              <p className="text-xs text-slate-500">Để theo dõi và phân tích sử dụng</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Items Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Reference Images & Variables</CardTitle>
          <Button onClick={addBatchItem} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {batchItems.map((item, index) => (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <Badge 
                        variant={
                          item.status === "completed" ? "default" :
                          item.status === "processing" ? "secondary" :
                          item.status === "error" ? "destructive" :
                          "outline"
                        }
                      >
                        {item.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                        {item.status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {item.status === "error" && <XCircle className="w-3 h-3 mr-1" />}
                        {item.status}
                      </Badge>
                    </div>
                    <Button 
                      onClick={() => removeBatchItem(item.id)}
                      variant="ghost" 
                      size="sm"
                      disabled={isGenerating}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reference Image Selection */}
                      <div>
                        <Label>Reference Image</Label>
                        <DriveImageBrowser 
                          onImageSelect={(images) => updateBatchItem(item.id, { referenceImageId: images[0] || "" })}
                          selectedImages={item.referenceImageId ? [item.referenceImageId] : []}
                          maxSelection={1}
                        />
                        {item.referenceImageId && (
                          <div className="mt-2">
                            <div className="w-20 h-20 bg-slate-100 rounded border overflow-hidden">
                              <img
                                src={getImageUrl(item.referenceImageId)}
                                alt="Reference preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to placeholder if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                  target.parentElement!.innerHTML = '<svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"></path></svg>';
                                }}
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate max-w-20">
                              {item.referenceImageId}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Variables Input */}
                      <div className="space-y-3">
                        <Label>Variables</Label>
                        {selectedTemplate?.variables.map((variable) => (
                          <div key={variable.name}>
                            <label className="text-sm text-slate-600">{variable.placeholder}</label>
                            <Input
                              placeholder={variable.defaultValue}
                              value={item.variables[variable.name] || variable.defaultValue}
                              onChange={(e) => updateItemVariable(item.id, variable.name, e.target.value)}
                              className="mt-1"
                              disabled={isGenerating}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Prompt Input */}
                    <div>
                      <Label>Custom Prompt (Tùy chọn)</Label>
                      <p className="text-xs text-slate-500 mb-2">
                        Nhập prompt tùy chỉnh. Nếu để trống, sẽ sử dụng template và variables ở trên.
                      </p>
                      <Textarea
                        placeholder="Nhập prompt tùy chỉnh của bạn ở đây..."
                        value={item.customPrompt}
                        onChange={(e) => updateItemCustomPrompt(item.id, e.target.value)}
                        className="h-20 text-sm"
                        disabled={isGenerating}
                      />
                      {item.customPrompt.trim() && (
                        <Badge variant="secondary" className="mt-2">
                          Đang sử dụng custom prompt
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Preview final prompt */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Label>Final Prompt Preview</Label>
                      {item.customPrompt.trim() ? (
                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Template</Badge>
                      )}
                    </div>
                    <Textarea
                      value={getFinalPrompt(item)}
                      readOnly
                      className="mt-1 h-20 text-xs bg-slate-50"
                      placeholder="Prompt sẽ được hiển thị ở đây..."
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {batchItems.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No batch items. Click "Add Item" to start.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {isGenerating && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="w-full" />
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                onClick={onSubmit}
                disabled={isGenerating || batchItems.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Batch...
                  </>
                ) : (
                  <>
                    <Flower className="w-5 h-5 mr-2" />
                    Generate All ({batchItems.length} items)
                  </>
                )}
              </Button>

              {results.length > 0 && (
                <Button onClick={downloadAllImages} variant="outline">
                  Download All Images
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {results.map((result, index) => (
                <div key={result.referenceImageId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Item {index + 1} - {result.referenceImageId}</h4>
                    {result.error ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge>Success</Badge>
                    )}
                  </div>
                  
                  {result.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.imageUrls.map((url, imgIndex) => (
                        <ImageResult
                          key={imgIndex}
                          src={url}
                          alt={`Result ${index + 1} - Image ${imgIndex + 1}`}
                          onDownload={async () => {
                            try {
                              const response = await fetch(url);
                              const blob = await response.blob();
                              const downloadUrl = window.URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = downloadUrl;
                              link.download = `batch-flower-${result.referenceImageId}-${imgIndex + 1}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(downloadUrl);
                            } catch (error) {
                              console.error("Failed to download image:", error);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
