import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`, {
        origin: req.get('Origin'),
        userAgent: req.get('User-Agent'),
        body: req.method === 'POST' ? { ...req.body, password: req.body.password ? '***' : undefined } : undefined
    });
    next();
};
