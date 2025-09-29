// This file provides client-side utilities for OpenAI image operations
// Note: All actual OpenAI API calls are handled on the server side for security

export interface GenerateImageResponse {
  imageUrls: string[];
}

export interface EditImageResponse {
  imageUrls: string[];
}

export interface CreateVariationsResponse {
  imageUrls: string[];
}

// Helper function to download images from URLs
export async function downloadImageFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("Failed to download image:", error);
    throw new Error("Failed to download image. Please try again.");
  }
}

// Helper function to validate image files
export function validateImageFile(file: File, allowedTypes: string[] = ['image/png']): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: "No file selected" };
  }

  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ');
    return { isValid: false, error: `Only ${allowedExtensions} files are allowed` };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { isValid: false, error: "File size must be less than 10MB" };
  }

  return { isValid: true };
}

// Helper function to create a preview URL for uploaded images
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

// Helper function to revoke image preview URLs
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url);
}

// Error messages for common OpenAI API errors
export const ERROR_MESSAGES = {
  INVALID_PROMPT: "Please provide a valid description for your image.",
  FILE_TOO_LARGE: "Image file is too large. Please use a file smaller than 10MB.",
  INVALID_FILE_TYPE: "Invalid file type. Please use PNG format for original images.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  API_ERROR: "API error. Please try again in a few moments.",
  RATE_LIMITED: "Too many requests. Please wait a moment before trying again.",
  INSUFFICIENT_CREDITS: "Insufficient API credits. Please check your OpenAI account.",
  CONTENT_FILTERED: "Content was filtered by OpenAI's safety system. Please try a different prompt.",
} as const;

// Helper function to get user-friendly error message
export function getErrorMessage(error: any): string {
  const errorMessage = error?.message || error?.toString() || "Unknown error";
  
  if (errorMessage.includes("rate limit")) {
    return ERROR_MESSAGES.RATE_LIMITED;
  }
  
  if (errorMessage.includes("insufficient")) {
    return ERROR_MESSAGES.INSUFFICIENT_CREDITS;
  }
  
  if (errorMessage.includes("content")) {
    return ERROR_MESSAGES.CONTENT_FILTERED;
  }
  
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  return errorMessage;
}
