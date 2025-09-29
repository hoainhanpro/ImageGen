import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DriveTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
}

interface DriveAuthContextType {
  tokens: DriveTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<void>;
}

const DriveAuthContext = createContext<DriveAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'drive-auth-tokens';
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

interface DriveAuthProviderProps {
  children: ReactNode;
}

export function DriveAuthProvider({ children }: DriveAuthProviderProps) {
  const [tokens, setTokens] = useState<DriveTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load tokens from localStorage on mount
  useEffect(() => {
    const loadStoredTokens = () => {
      try {
        const storedTokens = localStorage.getItem(STORAGE_KEY);
        if (storedTokens) {
          const parsedTokens: DriveTokens = JSON.parse(storedTokens);
          
          // Check if tokens are expired
          if (parsedTokens.expiry_date && parsedTokens.expiry_date > Date.now() + TOKEN_EXPIRY_BUFFER) {
            setTokens(parsedTokens);
          } else {
            // Tokens expired, remove from storage
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading stored tokens:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredTokens();
  }, []);

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    if (tokens) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [tokens]);

  // Check for auth code from callback
  useEffect(() => {
    const checkAuthCode = async () => {
      const authCode = localStorage.getItem('drive-auth-code');
      if (authCode && !tokens) {
        await handleAuthCode(authCode);
        localStorage.removeItem('drive-auth-code');
      }
    };
    
    if (!isLoading) {
      checkAuthCode();
    }
  }, [isLoading, tokens]);

  // Auto-refresh tokens when they're about to expire
  useEffect(() => {
    if (!tokens?.expiry_date || !tokens?.refresh_token) return;

    const timeUntilExpiry = tokens.expiry_date - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - TOKEN_EXPIRY_BUFFER, 1000);

    const refreshTimer = setTimeout(() => {
      refreshTokens();
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [tokens]);

  const handleAuthCode = async (code: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/drive/auth", { code });
      const result = await response.json();
      
      if (response.ok) {
        const newTokens: DriveTokens = {
          ...result.tokens,
          expiry_date: Date.now() + (result.tokens.expires_in || 3600) * 1000
        };
        setTokens(newTokens);
        
        toast({
          title: "Thành công!",
          description: "Đã kết nối với Google Drive.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Lỗi xác thực",
        description: error.message || "Không thể kết nối với Google Drive.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", "/api/drive/auth-url");
      const result = await response.json();
      
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error: any) {
      toast({
        title: "Lỗi đăng nhập",
        description: error.message || "Không thể tạo URL xác thực.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const logout = () => {
    setTokens(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('drive-auth-code');
    
    toast({
      title: "Đã đăng xuất",
      description: "Đã ngắt kết nối với Google Drive.",
    });
  };

  const refreshTokens = async () => {
    if (!tokens?.refresh_token) {
      logout();
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/drive/refresh", {
        refresh_token: tokens.refresh_token
      });
      const result = await response.json();
      
      if (response.ok) {
        const refreshedTokens: DriveTokens = {
          ...tokens,
          ...result.tokens,
          expiry_date: Date.now() + (result.tokens.expires_in || 3600) * 1000
        };
        setTokens(refreshedTokens);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  const value: DriveAuthContextType = {
    tokens,
    isAuthenticated: !!tokens,
    isLoading,
    login,
    logout,
    refreshTokens
  };

  return (
    <DriveAuthContext.Provider value={value}>
      {children}
    </DriveAuthContext.Provider>
  );
}

export function useDriveAuth() {
  const context = useContext(DriveAuthContext);
  if (context === undefined) {
    throw new Error('useDriveAuth must be used within a DriveAuthProvider');
  }
  return context;
}
