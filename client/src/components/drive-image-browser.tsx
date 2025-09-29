import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FolderOpen, Image as ImageIcon, Search, Check, Folder, ArrowLeft, Home, ChevronRight, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDriveAuth } from "@/contexts/drive-auth-context";
import type { DriveFile, DriveFolder } from "@shared/schema";

interface DriveImageBrowserProps {
  onImageSelect: (fileIds: string[]) => void;
  selectedImages: string[];
  maxSelection?: number;
}

export function DriveImageBrowser({ onImageSelect, selectedImages, maxSelection = 3 }: DriveImageBrowserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelectedImages, setLocalSelectedImages] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const { tokens, isAuthenticated, isLoading: authLoading, login, logout } = useDriveAuth();
  const { toast } = useToast();

  useEffect(() => {
    setLocalSelectedImages(selectedImages);
  }, [selectedImages]);

  // Get Drive files and folders structure
  const { data: driveData, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ["drive-structure", tokens, searchQuery, currentFolderId],
    queryFn: async () => {
      if (!tokens) return null;
      
      const queryParams = new URLSearchParams({
        tokens: JSON.stringify(tokens),
      });
      
      // Check folder FIRST, then search query
      if (currentFolderId) {
        queryParams.append("folderId", currentFolderId);
        
      } else if (searchQuery && !searchQuery.includes('drive.google.com')) {
        queryParams.append("query", searchQuery);
        
      } else {
        
      }

      
      const response = await apiRequest("GET", `/api/drive/files?${queryParams}`);
      return response.json();
    },
    enabled: !!tokens,
    staleTime: 10000, // Cache for 10 seconds
  });

  const toggleImageSelection = (fileId: string) => {
    setLocalSelectedImages(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else if (prev.length < maxSelection) {
        return [...prev, fileId];
      } else {
        toast({
          title: "Giới hạn lựa chọn",
          description: `Chỉ có thể chọn tối đa ${maxSelection} ảnh reference.`,
          variant: "destructive",
        });
        return prev;
      }
    });
  };

  const handleConfirmSelection = () => {
    onImageSelect(localSelectedImages);
    setIsOpen(false);
    toast({
      title: "Đã chọn ảnh reference",
      description: `Đã chọn ${localSelectedImages.length} ảnh từ Drive.`,
    });
  };

  // Extract folder ID from Google Drive link
  const extractFolderIdFromUrl = (url: string): string | null => {
    const patterns = [
      /\/folders\/([a-zA-Z0-9-_]+)/,
      /[\?&]id=([a-zA-Z0-9-_]+)/,
      /\/drive\/folders\/([a-zA-Z0-9-_]+)/,
      /\/drive\/u\/\d+\/folders\/([a-zA-Z0-9-_]+)/, // Handle /drive/u/X/folders/ID format
      /\/open\?id=([a-zA-Z0-9-_]+)/ // Handle /open?id=ID format
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        
        return match[1];
      }
    }
    
    return null;
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    // Check if input looks like a Google Drive folder link FIRST
    if (value.includes('drive.google.com') && (value.includes('folder') || value.includes('folders'))) {
      const folderId = extractFolderIdFromUrl(value);
      if (folderId) {
        
        // Reset search first, then set folder
        setSearchQuery("");
        setCurrentFolderId(folderId);
        toast({
          title: "Folder được phát hiện",
          description: `Đang tải ảnh từ folder: ${folderId}`,
        });
        return;
      }
    }
    
    // Reset folder ID first, then set search query
    setCurrentFolderId(undefined);
    setSearchQuery(value);
  };

  const getImageUrl = (fileId: string) => {
    if (!tokens) return "";
    const params = new URLSearchParams({
      tokens: JSON.stringify(tokens),
    });
    return `/api/drive/file/${fileId}?${params}`;
  };

  const navigateToFolder = (folderId?: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery(""); // Clear search when navigating
  };

  const navigateToParentFolder = () => {
    if (driveData?.currentFolder?.parents && driveData.currentFolder.parents.length > 0) {
      navigateToFolder(driveData.currentFolder.parents[0]);
    } else {
      navigateToFolder(undefined); // Go to root
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <FolderOpen className="w-4 h-4 mr-2" />
          Bộ sưu tập ({selectedImages.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Chọn ảnh reference từ Google Drive</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4 max-h-[75vh]">
          {!isAuthenticated ? (
            <div className="text-center py-8">
              <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">Kết nối với Google Drive để chọn ảnh reference</p>
              <Button onClick={login} disabled={authLoading}>
                {authLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                <FolderOpen className="w-4 h-4 mr-2" />
                )}
                {authLoading ? "Đang kết nối..." : "Kết nối Google Drive"}
              </Button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Tìm kiếm ảnh hoặc paste link folder Drive..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={() => refetchFiles()}>
                  Tải lại
                </Button>
              </div>

              {/* Selected count */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Đã chọn: {localSelectedImages.length}/{maxSelection}
                </p>
                <Button 
                  onClick={handleConfirmSelection}
                  disabled={localSelectedImages.length === 0}
                  size="sm"
                >
                  Xác nhận chọn
                </Button>
              </div>

              {/* Breadcrumbs */}
              {driveData?.breadcrumbs && driveData.breadcrumbs.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                  <Home className="w-4 h-4" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToFolder(undefined)}
                    className="p-0 h-auto font-normal"
                  >
                    Drive
                  </Button>
                  {driveData.breadcrumbs.map((folder: DriveFolder, index: number) => (
                    <div key={folder.id} className="flex items-center space-x-2">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToFolder(folder.id)}
                        className="p-0 h-auto font-normal"
                      >
                        {folder.name}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation */}
              {currentFolderId && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateToParentFolder}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateToFolder(undefined)}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Thư mục gốc
                  </Button>
                </div>
              )}

              {/* Files and folders grid */}
              <div className="flex-1 overflow-y-auto">
                {filesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : !driveData?.files?.length && !driveData?.folders?.length ? (
                  <div className="text-center py-8">
                    <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">Không tìm thấy file hoặc thư mục nào</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Folders section */}
                    {driveData?.folders && driveData.folders.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">📁 Thư mục</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {driveData.folders.map((folder: DriveFolder) => (
                            <Card 
                              key={folder.id}
                              className="cursor-pointer transition-all hover:shadow-md hover:bg-slate-50"
                              onClick={() => navigateToFolder(folder.id)}
                            >
                              <CardContent className="p-3 text-center">
                                <Folder className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                <p className="text-xs text-slate-600 truncate">
                                  {folder.name}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files section */}
                    {driveData?.files && driveData.files.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-2">🖼️ Ảnh ({driveData.files.length})</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {driveData.files.map((file: DriveFile) => (
                            <Card 
                              key={file.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                localSelectedImages.includes(file.id) 
                                  ? "ring-2 ring-blue-500 bg-blue-50" 
                                  : ""
                              }`}
                              onClick={() => toggleImageSelection(file.id)}
                            >
                              <CardContent className="p-2">
                                <div className="relative">
                                  <img
                                    src={getImageUrl(file.id)}
                                    alt={file.name}
                                    className="w-full h-24 object-contain rounded bg-slate-50"
                                    loading="lazy"
                                  />
                                  {localSelectedImages.includes(file.id) && (
                                    <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                                      <Check className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mt-1 truncate">
                                  {file.name}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
