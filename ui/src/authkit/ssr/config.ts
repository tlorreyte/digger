export type AuthConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cookiePassword: string;
  cookieName: string;
  cookieDomain?: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function getAuthConfig(): AuthConfig {
  const cookiePassword = required('SESSION_COOKIE_PASSWORD');
  if (cookiePassword.length < 32) {
    throw new Error('SESSION_COOKIE_PASSWORD must be at least 32 characters long');
  }

  return {
    issuerUrl: required('DEX_ISSUER_URL'),
    clientId: required('DEX_CLIENT_ID'),
    clientSecret: required('DEX_CLIENT_SECRET'),
    redirectUri: required('DEX_REDIRECT_URI'),
    cookiePassword,
    cookieName: process.env.SESSION_COOKIE_NAME || 'digger-session',
    cookieDomain: process.env.SESSION_COOKIE_DOMAIN || undefined,
  };
}
