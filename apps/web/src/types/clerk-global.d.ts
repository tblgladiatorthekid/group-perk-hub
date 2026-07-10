// Minimal ambient typing for the global `window.Clerk` instance that
// `<ClerkProvider>` attaches. Used by code that needs the current session
// token outside the React tree (route `beforeLoad` guards, the API client).
export {};

declare global {
  interface Window {
    Clerk?: {
      load: () => Promise<void>;
      session: {
        getToken: () => Promise<string | null>;
      } | null;
    };
  }
}
