// IndexedDB storage for persistent image history

export interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  size: string;
  timestamp: number;
  type: 'generate' | 'edit' | 'variation';
  parameters?: Record<string, any>;
}

export interface ImageGroup {
  date: string;
  images: HistoryImage[];
}

class ImageHistoryStorage {
  private dbName = 'openai-image-playground';
  private dbVersion = 1;
  private storeName = 'image-history';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async saveImage(image: Omit<HistoryImage, 'id' | 'timestamp'>): Promise<HistoryImage> {
    if (!this.db) await this.init();

    const historyImage: HistoryImage = {
      ...image,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(historyImage);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(historyImage);
    });
  }

  async getAllImages(): Promise<HistoryImage[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Sort by timestamp descending (newest first)
        const images = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(images);
      };
    });
  }

  async deleteImage(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteAllImages(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getImagesByDate(): Promise<ImageGroup[]> {
    const allImages = await this.getAllImages();
    const groups: { [date: string]: HistoryImage[] } = {};

    allImages.forEach(image => {
      const date = new Date(image.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(image);
    });

    return Object.entries(groups).map(([date, images]) => ({
      date,
      images,
    }));
  }
}

export const imageHistoryStorage = new ImageHistoryStorage();

// Utility functions
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}