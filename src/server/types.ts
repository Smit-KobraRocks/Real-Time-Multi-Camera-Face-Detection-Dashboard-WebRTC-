import type { JwtPayload } from './auth/jwt';

export type AppBindings = {
  Variables: {
    user: JwtPayload;
  };
};
