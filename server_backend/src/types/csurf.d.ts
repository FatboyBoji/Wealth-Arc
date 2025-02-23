declare module 'csurf' {
    import { RequestHandler } from 'express';

    interface CsurfOptions {
        cookie?: boolean | {
            key?: string;
            path?: string;
            httpOnly?: boolean;
            secure?: boolean;
            maxAge?: number;
            domain?: string;
            sameSite?: boolean | 'lax' | 'strict' | 'none';
        };
        ignoreMethods?: string[];
        sessionKey?: string;
        value?: (req: Express.Request) => string;
    }

    interface CSRFRequest extends Express.Request {
        csrfToken(): string;
    }

    function csurf(options?: CsurfOptions): RequestHandler;
    export = csurf;
} 