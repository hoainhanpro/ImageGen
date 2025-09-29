import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme-provider";
import { GenerateTab } from "@/components/generate-tab";
import { EditTab } from "@/components/edit-tab";
import { VariationsTab } from "@/components/variations-tab";
import { FlowerGeneratorTab } from "@/components/flower-generator-tab";
import { BatchFlowerGeneratorTab } from "@/components/batch-flower-generator-tab";
import { ImageHistoryPanel } from "@/components/image-history-panel";
import { Moon, Sun, History } from "lucide-react";
import { type HistoryImage } from "@/lib/imageHistory";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("flowers");
  const [continueEditImage, setContinueEditImage] = useState<HistoryImage | null>(null);

  // Handle continuing edit from history
  const handleContinueEdit = (image: HistoryImage) => {
    setContinueEditImage(image);
    setActiveTab("edit");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Flower Image Generator</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Generate beautiful flower images with AI templates and advanced models</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setIsHistoryOpen(true)}
                className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                <History className="w-5 h-5 mr-2 text-slate-600 dark:text-slate-300" />
                History
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {theme === "light" ? (
                  <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                ) : (
                  <Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="flowers" className="text-sm font-medium">
              Flower Generator
            </TabsTrigger>
            <TabsTrigger value="batch-flowers" className="text-sm font-medium">
              Batch Flowers
            </TabsTrigger>
            <TabsTrigger value="generate" className="text-sm font-medium">
              Generate from Text
            </TabsTrigger>
            <TabsTrigger value="edit" className="text-sm font-medium">
              Edit with Mask
            </TabsTrigger>
            <TabsTrigger value="variations" className="text-sm font-medium">
              Create Variations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flowers">
            <FlowerGeneratorTab />
          </TabsContent>

          <TabsContent value="batch-flowers">
            <BatchFlowerGeneratorTab />
          </TabsContent>

          <TabsContent value="generate">
            <GenerateTab />
          </TabsContent>

          <TabsContent value="edit">
            <EditTab 
              continueEditImage={continueEditImage}
              onContinueEditComplete={() => setContinueEditImage(null)}
            />
          </TabsContent>

          <TabsContent value="variations">
            <VariationsTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center text-slate-600 dark:text-slate-400">
            <p className="text-sm">OpenAI Image Playground - No-code AI image generation, editing, and variation creation</p>
            <p className="text-xs mt-2">Powered by OpenAI's Image API</p>
          </div>
        </div>
      </footer>

      {/* Image History Panel */}
      <ImageHistoryPanel 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        onContinueEdit={handleContinueEdit}
      />
    </div>
  );
}
