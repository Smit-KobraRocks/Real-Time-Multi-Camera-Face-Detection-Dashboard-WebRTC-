export const getEnvVar = (key: string, fallback?: string): string | undefined => {
  const viteEnv = typeof import.meta !== 'undefined' && (import.meta as any)?.env ? (import.meta as any).env[key] : undefined;
  const nodeEnv = typeof process !== 'undefined' && process.env ? (process.env as Record<string, string | undefined>)[key] : undefined;
  return (viteEnv as string | undefined) ?? nodeEnv ?? fallback;
};
