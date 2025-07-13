/**
 * @fileoverview Request Validation Middleware
 * @description Validates request bodies using Joi schemas
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Create validation middleware for request body
 */
export function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        errors
      });
    }

    // Replace request body with validated value
    req.body = value;
    next();
  };
}

/**
 * Create validation middleware for query parameters
 */
export function validateQuery(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        errors
      });
    }

    // Replace query with validated value
    req.query = value;
    next();
  };
}

/**
 * Create validation middleware for route parameters
 */
export function validateParams(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        errors
      });
    }

    // Replace params with validated value
    req.params = value;
    next();
  };
}