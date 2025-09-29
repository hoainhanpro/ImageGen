import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { imageHistoryStorage, type HistoryImage, type ImageGroup, formatDate, formatTime } from "@/lib/imageHistory";
import { History, ChevronDown, ChevronUp, Trash2, Download, Copy, Eye, Expand, Minimize, AlertTriangle, ChevronRight, Plus, Image as ImageIcon, Info } from "lucide-react";
import { downloadImageFromUrl } from "@/lib/openai";

interface ImageHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueEdit?: (image: HistoryImage) => void;
}

export function ImageHistoryPanel({ isOpen, onClose, onContinueEdit }: ImageHistoryPanelProps) {
  const [imageGroups, setImageGroups] = useState<ImageGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<HistoryImage | null>(null);
  const [detailsImage, setDetailsImage] = useState<HistoryImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load images on mount and when panel opens
  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

  // Expand today's group by default
  useEffect(() => {
    if (imageGroups.length > 0) {
      const todayGroup = imageGroups.find(group => formatDate(group.date) === 'Today');
      if (todayGroup) {
        setExpandedGroups(new Set([todayGroup.date]));
      }
    }
  }, [imageGroups]);

  const loadImages = async () => {
    try {
      setIsLoading(true);
      const groups = await imageHistoryStorage.getImagesByDate();
      setImageGroups(groups);
    } catch (error) {
      toast({
        title: "Error Loading History",
        description: "Failed to load image history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await imageHistoryStorage.deleteImage(imageId);
      await loadImages();
      toast({
        title: "Image Deleted",
        description: "Image removed from history successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      await imageHistoryStorage.deleteAllImages();
      await loadImages();
      toast({
        title: "History Cleared",
        description: "All images have been removed from history.",
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Failed to clear history. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadImage = async (image: HistoryImage) => {
    try {
      const timestamp = formatTime(image.timestamp).replace(/[: ]/g, '-');
      const filename = `${image.type}-${timestamp}.png`;
      await downloadImageFromUrl(image.url, filename);
      toast({
        title: "Download Started",
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({
        title: "Prompt Copied",
        description: "Prompt copied to clipboard successfully.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy prompt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleGroup = (date: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedGroups(new Set(imageGroups.map(group => group.date)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const totalImages = imageGroups.reduce((total, group) => total + group.images.length, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}`}
        onClick={onClose} 
      />
      
      {/* Side panel */}
      <div className={`fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <Card className="w-96 h-full flex flex-col bg-white dark:bg-slate-950 shadow-2xl border-l">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <CardTitle className="text-lg">History</CardTitle>
              <Badge variant="secondary">{totalImages}</Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Close panel"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-3">
            {imageGroups.length > 1 && (
              <>
                <Button variant="outline" size="sm" onClick={expandAll}>
                  <Expand className="w-4 h-4 mr-1" />
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  <Minimize className="w-4 h-4 mr-1" />
                  Collapse All
                </Button>
              </>
            )}
            {totalImages > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Clear All History
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {totalImages} images from your history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-pulse" />
                    <p className="text-slate-500">Loading history...</p>
                  </div>
                </div>
              ) : imageGroups.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">No images in history yet</p>
                    <p className="text-sm text-slate-400">Generated images will appear here</p>
                  </div>
                </div>
              ) : (
                <div>
                  {imageGroups.map((group, index) => (
                    <Collapsible
                      key={group.date}
                      open={expandedGroups.has(group.date)}
                      onOpenChange={() => toggleGroup(group.date)}
                      className={index > 0 ? "mt-4" : ""}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{formatDate(group.date)}</h3>
                            <Badge variant="outline">{group.images.length} images</Badge>
                          </div>
                          {expandedGroups.has(group.date) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="mt-3">
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          {group.images.map((image) => (
                            <div key={image.id} className="group relative">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all"
                                    onClick={() => setDetailsImage(image)}
                                  >
                                    <img
                                      src={image.url}
                                      alt={`Generated: ${image.prompt.slice(0, 50)}...`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all" />
                                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <Badge variant="secondary" className="text-xs">
                                        {image.type}
                                      </Badge>
                                    </div>
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <div className="text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded">
                                        {formatTime(image.timestamp)}
                                      </div>
                                    </div>
                                    
                                    {/* Continue Edit Button */}
                                    {onContinueEdit && (
                                      <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="w-6 h-6 p-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onContinueEdit(image);
                                            onClose();
                                          }}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm">
                                  <div className="space-y-1">
                                    <p className="font-semibold">Prompt:</p>
                                    <p className="text-sm">{image.prompt}</p>
                                    <p className="text-xs text-slate-400">
                                      Model: {image.model} • Size: {image.size}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              
                              <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="w-6 h-6 p-0 rounded-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Image</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this image from your history? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteImage(image.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Image Preview
                <Badge variant="secondary">{selectedImage.type}</Badge>
              </DialogTitle>
              <DialogDescription>
                Generated on {formatDate(new Date(selectedImage.timestamp).toDateString())} at {formatTime(selectedImage.timestamp)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={selectedImage.url}
                  alt="Preview"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1">Prompt:</h4>
                  <p className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">{selectedImage.prompt}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Model:</span> {selectedImage.model}
                  </div>
                  <div>
                    <span className="font-semibold">Size:</span> {selectedImage.size}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => handleCopyPrompt(selectedImage.prompt)} variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Prompt
                </Button>
                <Button onClick={() => handleDownloadImage(selectedImage)} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Details Dialog */}
      {detailsImage && (
        <Dialog open={!!detailsImage} onOpenChange={() => setDetailsImage(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Image Details
                <Badge variant="secondary">{detailsImage.type}</Badge>
              </DialogTitle>
              <DialogDescription>
                Generated on {formatDate(new Date(detailsImage.timestamp).toDateString())} at {formatTime(detailsImage.timestamp)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Input Images and Generated Result - Side by Side Layout */}
              {detailsImage.parameters?.originalImages && detailsImage.parameters.originalImages.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Input Images Section */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <ImageIcon className="w-4 h-4" />
                      Input Images Used:
                    </h4>
                    <div className="space-y-3">
                      {detailsImage.parameters.originalImages.map((imageUrl: string, index: number) => (
                        <div key={index} className="relative border-2 border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                          <img
                            src={imageUrl}
                            alt={`Input ${index + 1}`}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute top-2 left-2">
                            <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                              Input {index + 1}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      
                      {/* Mask Image in Input Section */}
                      {detailsImage.parameters?.maskImage && (
                        <div className="relative border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                          <img
                            src={detailsImage.parameters.maskImage}
                            alt="Mask"
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute top-2 left-2">
                            <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700">
                              Mask
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Generated Result Section */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Eye className="w-4 h-4" />
                      Generated Result:
                    </h4>
                    <div className="relative border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                      <img
                        src={detailsImage.url}
                        alt="Generated Result"
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                          Result
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Generated Image Only (no inputs) */
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Eye className="w-4 h-4" />
                    Generated Result:
                  </h4>
                  <div className="flex justify-center">
                    <img
                      src={detailsImage.url}
                      alt="Generated Image"
                      className="max-w-full max-h-[40vh] object-contain rounded-lg border-2 border-blue-200 dark:border-blue-800"
                    />
                  </div>
                </div>
              )}
              
              {/* Prompt */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <span>Prompt:</span>
                </h4>
                <p className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border">
                  {detailsImage.prompt}
                </p>
              </div>
              
              {/* Generation Parameters */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                <div>
                  <span className="font-semibold">Model:</span> {detailsImage.model}
                </div>
                <div>
                  <span className="font-semibold">Size:</span> {detailsImage.size}
                </div>
                {detailsImage.parameters?.quality && (
                  <div>
                    <span className="font-semibold">Quality:</span> {detailsImage.parameters.quality}
                  </div>
                )}
                {detailsImage.parameters?.style && (
                  <div>
                    <span className="font-semibold">Style:</span> {detailsImage.parameters.style}
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => handleCopyPrompt(detailsImage.prompt)} variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Prompt
                </Button>
                <Button onClick={() => handleDownloadImage(detailsImage)} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button 
                  onClick={() => setSelectedImage(detailsImage)}
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Full Preview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </>
  );
}