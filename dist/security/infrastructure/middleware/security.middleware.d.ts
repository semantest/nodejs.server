/**
 * Security middleware for input validation and protection
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Rate limiting configurations
 */
export declare const rateLimiters: {
    api: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    strict: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    enqueue: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    messages: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
};
/**
 * Basic input validation
 */
export declare const validateInput: {
    url: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    priority: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    metadata: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    aiTool: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    id: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
};
/**
 * Input sanitization middleware
 */
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Security headers middleware
 */
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Request size limiting
 */
export declare const requestSizeLimits: {
    json: string;
    urlencoded: string;
};
/**
 * Combined validation for queue enqueue
 */
export declare const validateEnqueue: ((req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>)[];
//# sourceMappingURL=security.middleware.d.ts.map