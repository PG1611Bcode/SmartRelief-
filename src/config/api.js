/**
 * Centralized API base URL configuration for SmartRelief.
 * Automatically picks up VITE_API_URL in production (Vercel/Render)
 * and falls back to http://localhost:8000 for local development.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000')
).replace(/\/$/, '');

