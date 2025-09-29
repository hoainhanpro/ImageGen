import { google } from 'googleapis';
import { Readable } from 'stream';
import type { DriveFile, DriveFolder } from '@shared/schema';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

export class DriveService {
  private oauth2Client: any;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  getAuthUrl(): string {
    console.log("DriveService - Generating auth URL");
    console.log("Client ID:", process.env.GOOGLE_CLIENT_ID);
    console.log("Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "Present" : "Missing");
    console.log("Redirect URI:", process.env.GOOGLE_REDIRECT_URI);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });
    
    console.log("Generated Auth URL:", authUrl);
    return authUrl;
  }

  async getAccessToken(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<any> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    return credentials;
  }

  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  async listFiles(folderId?: string, query?: string): Promise<DriveFile[]> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    let searchQuery = "mimeType contains 'image/'";
    if (folderId) {
      searchQuery += ` and '${folderId}' in parents`;
    }
    if (query) {
      searchQuery += ` and name contains '${query}'`;
    }

    console.log("DriveService - listFiles query:", searchQuery);
    console.log("DriveService - folderId:", folderId);

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,size,shared,owners,parents)',
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives', // Include files from all drives (including shared drives)
    });

    console.log("DriveService - API response status:", response.status);
    console.log("DriveService - Raw files found:", response.data.files?.length || 0);
    console.log("DriveService - First 3 files:", response.data.files?.slice(0, 3).map(f => ({ id: f.id, name: f.name })));

    return response.data.files?.map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      webViewLink: file.webViewLink || undefined,
      thumbnailLink: file.thumbnailLink || undefined,
      size: file.size || undefined,
      parents: file.parents || [],
    })) || [];
  }

  async listFolders(parentFolderId?: string): Promise<DriveFolder[]> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    let searchQuery = "mimeType = 'application/vnd.google-apps.folder'";
    if (parentFolderId) {
      searchQuery += ` and '${parentFolderId}' in parents`;
    }

    console.log("DriveService - listFolders query:", searchQuery);
    console.log("DriveService - parentFolderId:", parentFolderId);

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id,name,mimeType,webViewLink,parents)',
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives',
    });

    console.log("DriveService - Folders found:", response.data.files?.length || 0);

    return response.data.files?.map(folder => ({
      id: folder.id!,
      name: folder.name!,
      mimeType: folder.mimeType!,
      webViewLink: folder.webViewLink || undefined,
      parents: folder.parents || [],
    })) || [];
  }

  async getFilesAndFoldersStructure(folderId?: string, query?: string): Promise<{
    folders: DriveFolder[];
    files: DriveFile[];
    currentFolder?: DriveFolder;
    breadcrumbs: DriveFolder[];
  }> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    // Get current folder info if folderId provided
    let currentFolder: DriveFolder | undefined;
    let breadcrumbs: DriveFolder[] = [];
    
    if (folderId) {
      try {
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id,name,mimeType,webViewLink,parents',
        });
        
        if (folderResponse.data) {
          currentFolder = {
            id: folderResponse.data.id!,
            name: folderResponse.data.name!,
            mimeType: folderResponse.data.mimeType!,
            webViewLink: folderResponse.data.webViewLink || undefined,
            parents: folderResponse.data.parents || [],
          };
          
          // Build breadcrumbs
          breadcrumbs = await this.buildBreadcrumbs(currentFolder);
        }
      } catch (error) {
        console.error("Error getting folder info:", error);
      }
    }

    // Get folders in current directory
    const folders = await this.listFolders(folderId);
    
    // Get files in current directory
    const files = await this.listFiles(folderId, query);

    return {
      folders,
      files,
      currentFolder,
      breadcrumbs,
    };
  }

  private async buildBreadcrumbs(folder: DriveFolder): Promise<DriveFolder[]> {
    const breadcrumbs: DriveFolder[] = [folder];
    let currentFolder = folder;
    
    // Traverse up the parent chain
    while (currentFolder.parents && currentFolder.parents.length > 0) {
      try {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        const parentResponse = await drive.files.get({
          fileId: currentFolder.parents[0],
          fields: 'id,name,mimeType,webViewLink,parents',
        });
        
        if (parentResponse.data && parentResponse.data.name !== 'My Drive') {
          const parentFolder: DriveFolder = {
            id: parentResponse.data.id!,
            name: parentResponse.data.name!,
            mimeType: parentResponse.data.mimeType!,
            webViewLink: parentResponse.data.webViewLink || undefined,
            parents: parentResponse.data.parents || [],
          };
          
          breadcrumbs.unshift(parentFolder);
          currentFolder = parentFolder;
        } else {
          break;
        }
      } catch (error) {
        console.error("Error building breadcrumbs:", error);
        break;
      }
    }
    
    return breadcrumbs;
  }

  async getFile(fileId: string): Promise<Buffer> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    }, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data as ArrayBuffer);
  }

  async uploadFile(fileName: string, buffer: Buffer, parentFolderId?: string): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    const fileMetadata: any = {
      name: fileName,
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    // Create a readable stream from the buffer
    const stream = Readable.from(buffer);

    const media = {
      mimeType: 'image/png',
      body: stream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    return response.data.id!;
  }

  async uploadImageFromUrl(imageUrl: string, fileName: string, parentFolderId?: string): Promise<string> {
    try {
      // Fetch the image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Upload to Drive
      return await this.uploadFile(fileName, buffer, parentFolderId);
    } catch (error) {
      console.error('Error uploading image from URL:', error);
      throw error;
    }
  }

  async createFolder(name: string, parentFolderId?: string): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    const fileMetadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return response.data.id!;
  }
}

export const driveService = new DriveService();
