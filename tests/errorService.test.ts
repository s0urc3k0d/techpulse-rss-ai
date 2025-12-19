import { describe, it, expect } from 'vitest';
import { handleError, AppError } from '../services/errorService';

describe('errorService', () => {
  describe('handleError', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      const appError = handleError(error);
      
      expect(appError.message).toBe('Test error');
      expect(appError.originalError).toBe(error);
    });

    it('should handle string errors', () => {
      const error = 'Simple error message';
      const appError = handleError(error);
      
      expect(appError.message).toBe(error);
      expect(appError.canRetry).toBe(false);
    });

    it('should detect retryable errors', () => {
      const networkError = new Error('Failed to fetch');
      const appError = handleError(networkError);
      
      expect(appError.canRetry).toBe(true);
    });

    it('should detect non-retryable errors', () => {
      const validationError = new Error('Invalid input');
      const appError = handleError(validationError);
      
      expect(appError.canRetry).toBe(false);
    });

    it('should handle unknown error types', () => {
      const unknownError = { weird: 'object' };
      const appError = handleError(unknownError);
      
      expect(appError.message).toBe('Une erreur inconnue est survenue');
      expect(appError.canRetry).toBe(false);
    });
  });
});
