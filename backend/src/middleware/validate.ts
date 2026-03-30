import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/apiResponse';

type ValidateTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[target];
    const result = schema.safeParse(data);

    if (result.success) {
      req[target] = result.data;
      next();
    } else {
      const err = result.error as ZodError;
      const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      sendError(res, `Validation error: ${message}`, 400);
    }
  };
}
