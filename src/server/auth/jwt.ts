import jwt from 'jsonwebtoken';
import env from '../config/env';

export type JwtPayload = {
  userId: string;
  username: string;
};

const TOKEN_EXPIRATION = '1h';

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
};

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
};
