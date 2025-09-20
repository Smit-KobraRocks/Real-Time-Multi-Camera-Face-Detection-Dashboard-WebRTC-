import type { Hono } from 'hono';
import type { AppBindings } from '../types';
import { loginRoutes } from './login';
import { cameraRoutes } from './cameras';
import { alertRoutes } from './alerts';
import { registerWebSocketRoutes } from './ws';

export const registerRoutes = (app: Hono<AppBindings>) => {
  app.route('/', loginRoutes);
  app.route('/cameras', cameraRoutes);
  app.route('/alerts', alertRoutes);
  registerWebSocketRoutes(app);
};
