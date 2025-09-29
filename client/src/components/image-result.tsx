import { useState } from "react";
import { Download, CloudUpload, Loader2, FolderPlus, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDriveAuth } from "@/contexts/drive-auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImageResultProps {
  src: string;
  alt: string;
  onDownload: () => void;
  className?: string;
}

export function ImageResult({ src, alt, onDownload, className = "" }: ImageResultProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customFileName, setCustomFileName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const { isAuthenticated, tokens } = useDriveAuth();
  const { toast } = useToast();

  // Generate default filename
  const generateDefaultFileName = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `generated-image-${timestamp}`;
  };

  // Load folders when dialog opens
  const loadFolders = async () => {
    if (!tokens) return;
    
    setIsLoadingFolders(true);
    try {
      const response = await apiRequest("GET", `/api/drive/files?tokens=${encodeURIComponent(JSON.stringify(tokens))}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !tokens) return;
    
    setIsCreatingFolder(true);
    try {
      const response = await apiRequest("POST", "/api/drive/create-folder", {
        name: newFolderName.trim(),
        tokens: JSON.stringify(tokens),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "✅ Tạo folder thành công!",
          description: `Folder "${newFolderName}" đã được tạo`,
        });
        setNewFolderName("");
        loadFolders(); // Reload folders
        setSelectedFolder(result.folderId); // Select the new folder
      } else {
        const error = await response.json();
        
        // Handle insufficient permission error
        if (error.message?.includes("Insufficient Permission") || error.error?.includes("Insufficient Permission")) {
          toast({
            title: "❌ Thiếu quyền truy cập",
            description: "Bạn cần đăng nhập lại Google Drive để có quyền tạo folder. Vui lòng làm mới trang và đăng nhập lại.",
            variant: "destructive",
          });
        } else {
          throw new Error(error.message || "Không thể tạo folder");
        }
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      
      // Check if it's a permission error
      const errorMessage = error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo folder";
      if (errorMessage.includes("Insufficient Permission")) {
        toast({
          title: "❌ Thiếu quyền truy cập",
          description: "Bạn cần đăng nhập lại Google Drive để có quyền tạo folder. Vui lòng làm mới trang và đăng nhập lại.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Lỗi tạo folder",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle dialog open
  const handleOpenDialog = () => {
    if (!isAuthenticated || !tokens) {
      toast({
        title: "Chưa xác thực Drive",
        description: "Vui lòng đăng nhập Google Drive trước khi lưu ảnh",
        variant: "destructive",
      });
      return;
    }
    
    setCustomFileName(generateDefaultFileName());
    setIsDialogOpen(true);
    loadFolders();
  };

  // Handle save to drive with custom options
  const handleSaveToDrive = async () => {
    if (!customFileName.trim()) {
      toast({
        title: "Tên file không hợp lệ",
        description: "Vui lòng nhập tên file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = customFileName.includes('.') ? customFileName : `${customFileName}.png`;
      
      // Convert __root__ back to undefined for API
      const actualFolderId = selectedFolder === "__root__" ? undefined : selectedFolder;

      const response = await apiRequest("POST", "/api/drive/upload-image", {
        imageUrl: src,
        fileName,
        folderId: actualFolderId,
        tokens: JSON.stringify(tokens),
      });

      if (response.ok) {
        const result = await response.json();
        const folderName = selectedFolder === "__root__" || !selectedFolder
          ? "My Drive"
          : folders.find(f => f.id === selectedFolder)?.name || "Unknown folder";
        
        toast({
          title: "Đã lưu thành công!",
          description: `Ảnh "${fileName}" đã được lưu vào "${folderName}"`,
        });
        setIsDialogOpen(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || "Không thể lưu ảnh");
      }
    } catch (error) {
      console.error("Error saving to Drive:", error);
      toast({
        title: "Lỗi lưu ảnh",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi lưu ảnh vào Drive",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className={`group relative rounded-lg overflow-hidden shadow-md transition-transform hover:scale-[1.02] ${className}`}>
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-auto"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <Button 
              onClick={onDownload}
              className="bg-white dark:bg-white text-slate-800 dark:text-slate-800 px-3 py-2 rounded-lg font-medium shadow-lg hover:bg-slate-50 dark:hover:bg-slate-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            
            {isAuthenticated ? (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleOpenDialog}
                    className="bg-blue-600 dark:bg-blue-600 text-white dark:text-white px-3 py-2 rounded-lg font-medium shadow-lg hover:bg-blue-700 dark:hover:bg-blue-700"
                  >
                    <CloudUpload className="w-4 h-4 mr-1" />
                    Lưu vào Drive
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Lưu ảnh vào Google Drive</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Filename input */}
                    <div className="space-y-2">
                      <Label htmlFor="filename">Tên file</Label>
                      <div className="flex gap-2">
                        <Input
                          id="filename"
                          value={customFileName}
                          onChange={(e) => setCustomFileName(e.target.value)}
                          placeholder="Nhập tên file"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomFileName(generateDefaultFileName())}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">
                        {!customFileName.includes('.') && "Đuôi .png sẽ được tự động thêm"}
                      </p>
                    </div>

                    {/* Folder selection */}
                    <div className="space-y-2">
                      <Label>Chọn folder</Label>
                      <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                        <SelectTrigger>
                          <SelectValue placeholder="My Drive (Root)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__root__">My Drive (Root)</SelectItem>
                          {isLoadingFolders ? (
                            <SelectItem value="__loading__" disabled>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Đang tải...
                            </SelectItem>
                          ) : (
                            folders.map((folder) => (
                              <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Create new folder */}
                    <div className="space-y-2">
                      <Label>Hoặc tạo folder mới</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Tên folder mới"
                          className="flex-1"
                        />
                        <Button
                          onClick={handleCreateFolder}
                          disabled={!newFolderName.trim() || isCreatingFolder}
                          size="sm"
                        >
                          {isCreatingFolder ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FolderPlus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => setIsDialogOpen(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={handleSaveToDrive}
                        disabled={isUploading || !customFileName.trim()}
                        className="flex-1"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-4 h-4 mr-2" />
                            Lưu ảnh
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button 
                onClick={() => {
                  toast({
                    title: "Chưa xác thực Drive",
                    description: "Vui lòng đăng nhập Google Drive để sử dụng tính năng này",
                    variant: "destructive",
                  });
                }}
                className="bg-gray-500 dark:bg-gray-500 text-white dark:text-white px-3 py-2 rounded-lg font-medium shadow-lg opacity-60"
              >
                <CloudUpload className="w-4 h-4 mr-1" />
                Drive
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
