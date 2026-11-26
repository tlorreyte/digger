import { unsealData } from 'iron-session';

// Request logging utilities
export async function extractUserInfoFromRequest(req) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'digger-session';
    const cookiePassword = process.env.SESSION_COOKIE_PASSWORD;
    
    if (!cookiePassword) {
      return { userId: 'anonymous', orgId: 'anonymous' };
    }
    
    const cookieHeader = req.headers?.cookie || req.getHeader?.('cookie');
    if (!cookieHeader) {
      return { userId: 'anonymous', orgId: 'anonymous' };
    }
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
    
    const sessionCookie = cookies[cookieName];
    if (!sessionCookie) {
      return { userId: 'anonymous', orgId: 'anonymous' };
    }
    
    const session = await unsealData(sessionCookie, {
      password: cookiePassword,
    });
    
    if (!session?.user?.id) {
      return { userId: 'anonymous', orgId: 'anonymous' };
    }

    const orgId = session.organizationId || 'anonymous';
    
    return { userId: session.user.id, orgId };
  } catch (error) {
    return { userId: 'anonymous', orgId: 'anonymous' };
  }
}

export function logRequestInit(method, path, requestId, userId, orgId) {
  console.log(JSON.stringify({
    event: 'request_initialized',
    method,
    path,
    requestId,
    userId,
    orgId,
  }));
}

export function logResponse(method, path, requestId, latency, statusCode, commitSha) {
  console.log(JSON.stringify({
    event: 'response_sent',
    method,
    path,
    requestId,
    latency,
    statusCode,
    commitSha: commitSha || 'unknown',
  }));
}

