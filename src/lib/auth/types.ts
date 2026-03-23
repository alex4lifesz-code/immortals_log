// src/lib/auth/types.ts — Authentication type definitions

export interface AuthPayload {
  /** User ID (cuid) */
  userId: string;
  /** Username */
  username: string;
  /** Display name */
  name: string;
  /** User role: "admin" or "user" */
  role: string;
  /** Token issued-at timestamp (epoch seconds) */
  iat: number;
  /** Token expiration timestamp (epoch seconds) */
  exp: number;
}

export interface AuthContext {
  userId: string;
  username: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AuthError";
  }

  static unauthorized(message = "Authentication required") {
    return new AuthError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Access denied") {
    return new AuthError(403, message, "FORBIDDEN");
  }

  static invalidToken(message = "Invalid or expired token") {
    return new AuthError(401, message, "INVALID_TOKEN");
  }
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: string;
}
