import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[part]);
      // Replace the request part with the parsed (and potentially transformed) data
      (req as any)[part] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
