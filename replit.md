# OpenAI Image Playground

## Overview

This is a full-stack web application that provides a user-friendly interface for interacting with OpenAI's image generation APIs. The application allows users to generate images from text prompts, edit images using masks, and create variations of existing images. Built with a modern React frontend and Express.js backend, it provides a clean, no-code experience for AI image manipulation.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **File Uploads**: Multer for handling image file uploads
- **Session Management**: Express sessions with PostgreSQL storage

### Design Patterns
- **Monorepo Structure**: Shared schema and types between frontend and backend
- **Type Safety**: End-to-end TypeScript with shared validation schemas
- **Component Architecture**: Modular React components with clear separation of concerns
- **API Design**: RESTful endpoints with proper error handling and validation

## Key Components

### Frontend Components
1. **GenerateTab**: Handles text-to-image generation with configurable parameters
2. **EditTab**: Manages image editing with mask upload functionality
3. **VariationsTab**: Creates multiple variations from a source image
4. **ImageResult**: Reusable component for displaying generated images with download functionality
5. **ThemeProvider**: Dark/light mode toggle with persistent preferences

### Backend Services
1. **OpenAI Integration**: Wrapper functions for DALL-E API calls
   - Image generation from text prompts
   - Image editing with masks
   - Image variation creation
2. **File Upload Handler**: Multer configuration for secure image uploads
3. **Storage Layer**: Abstracted storage interface with in-memory implementation
4. **API Routes**: Express routes with proper validation and error handling

### Database Schema
- **Users Table**: Basic user authentication structure
- **Image Generations Table**: Stores generation history with prompts and results
- **Session Management**: PostgreSQL-backed session storage

## Data Flow

1. **Image Generation Flow**:
   - User inputs text prompt and selects parameters
   - Frontend validates input using Zod schemas
   - Request sent to `/api/generate` endpoint
   - Backend calls OpenAI DALL-E API
   - Generated image URLs returned and displayed
   - Generation details stored in database

2. **Image Editing Flow**:
   - User uploads original image and mask
   - Files validated for correct format (PNG for original, any image for mask)
   - Request sent to `/api/edit` with FormData
   - Backend processes files and calls OpenAI edit API
   - Edited image URL returned and displayed

3. **Image Variations Flow**:
   - User uploads source image (PNG only)
   - Request sent to `/api/variations` endpoint
   - Backend creates multiple variations using OpenAI API
   - All variation URLs returned and displayed in grid

## External Dependencies

### Core Dependencies
- **OpenAI SDK**: Official OpenAI client for API interactions
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL support
- **Neon Database**: Serverless PostgreSQL provider
- **Shadcn/UI**: Pre-built React components with Radix UI primitives
- **TanStack React Query**: Server state management and caching
- **Multer**: File upload middleware for Express

### Development Dependencies
- **Vite**: Fast build tool with HMR support
- **TypeScript**: Static type checking
- **Tailwind CSS**: Utility-first CSS framework
- **ESLint/Prettier**: Code formatting and linting

### API Integration
- **OpenAI DALL-E 3**: Primary image generation model
- **Environment Variables**: Secure API key management
- **Error Handling**: Comprehensive error handling for API failures

## Deployment Strategy

### Development Environment
- **Hot Reload**: Vite dev server with instant updates
- **Type Checking**: Real-time TypeScript validation
- **Database**: Local PostgreSQL or Neon development database
- **Environment**: NODE_ENV=development with debug logging

### Production Build
- **Frontend**: Vite production build with optimizations
- **Backend**: ESBuild compilation for Node.js
- **Static Assets**: Served from Express with proper caching headers
- **Database**: Neon production database with connection pooling

### Environment Configuration
- **API Keys**: OpenAI API key stored in environment variables
- **Database**: PostgreSQL connection string from Neon
- **Build Scripts**: Separate development and production commands
- **Health Checks**: API endpoint validation and database connectivity

### Deployment Requirements
- Node.js runtime environment
- PostgreSQL database (Neon recommended)
- OpenAI API key with image generation permissions
- File upload storage (currently in-memory, extensible to cloud storage)

## Changelog
```
Changelog:
- June 29, 2025. Initial setup
- June 29, 2025. Major upgrade: Added comprehensive OpenAI API parameter support including model selection (DALL-E 2, DALL-E 3, GPT Image 1), dynamic size options, quality settings, style controls, response formats, and advanced parameters like compression, background, and moderation
- June 29, 2025. Database integration: Replaced in-memory storage with PostgreSQL database using Drizzle ORM for persistent data storage of users and image generations
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```