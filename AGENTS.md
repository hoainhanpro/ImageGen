# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Structure (Non-Obvious)
- Vite root is `client/` directory, NOT project root
- Build outputs to `dist/public/` for static files and `dist/` for server bundle
- Schema and shared types in `shared/` directory with `@shared/*` alias
- Attached assets accessible via `@assets/*` alias (points to `attached_assets/`)

## Server Requirements
- MUST serve on port 5000 (hardcoded for Replit, not configurable)
- Server uses dual OpenAI instances: default + per-request with API key
- API key fallback: `OPENAI_API_KEY` || `OPENAI_API_KEY_ENV_VAR` || "default_key"

## OpenAI Implementation Details
- Client-side `lib/openai.ts` contains ONLY utilities (no API calls)
- Server-side `lib/openai.ts` handles all OpenAI API interactions
- Model-specific parameter validation: dall-e-3 forces `n=1`, different quality options per model
- File buffer conversion uses hex header detection for MIME type
- Image editing masks must be PNG format regardless of input format
- Response format handling differs between dall-e-2/3 vs gpt-image-1

## Development Specifics
- Uses `import.meta.dirname` instead of `__dirname` (ES modules)
- Request logging captures JSON responses and truncates at 80 chars
- Error middleware throws after responding (for debugging)
- ShadCN components use "new-york" style with CSS variables
- Database migrations output to `./migrations` directory

## Windows Compatibility
- npm scripts with NODE_ENV fail on Windows PowerShell (use `$env:NODE_ENV="development"; tsx server/index.ts`)
- Or use cross-env package for cross-platform environment variables