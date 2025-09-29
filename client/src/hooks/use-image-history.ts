import { useCallback } from 'react';
import { imageHistoryStorage, type HistoryImage } from '@/lib/imageHistory';
import { useToast } from '@/hooks/use-toast';

export function useImageHistory() {
  const { toast } = useToast();

  const saveToHistory = useCallback(async (
    urls: string[],
    prompt: string,
    model: string,
    size: string,
    type: 'generate' | 'edit' | 'variation',
    parameters?: Record<string, any>
  ) => {
    try {
      const savePromises = urls.map(url => 
        imageHistoryStorage.saveImage({
          url,
          prompt,
          model,
          size,
          type,
          parameters,
        })
      );
      
      await Promise.all(savePromises);
    } catch (error) {
      console.error('Failed to save images to history:', error);
      // Don't show error toast for history save failures to avoid interrupting user flow
    }
  }, []);

  return {
    saveToHistory,
  };
}