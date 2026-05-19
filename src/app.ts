import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspaces/workspace.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import commentRoutes from './modules/comments/comment.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';

dotenv.config();

const app: Express = express();

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 login/register requests per windowMs
    message: 'Too many login attempts, please try again in 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use((req, res, next) => {
    console.log(`[CORS Debug] Request Method: ${req.method}, Origin: ${req.headers.origin}`);
    console.log(`[CORS Debug] ALLOWED_ORIGINS env: "${process.env.ALLOWED_ORIGINS}"`);
    next();
});
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(item => item.trim()) : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(generalLimiter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to Nexus API' });
});

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' && status === 500
        ? 'Internal Server Error'
        : err.message || 'Something went wrong';

    res.status(status).json({
        error: {
            message,
            status,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        },
    });
});

export default app;
