export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class InvalidFileError extends AppError {
  constructor(message: string = 'Unsupported screenplay format. Only PDF, TXT, and Fountain formats are supported.') {
    super(400, 'INVALID_FILE', message);
  }
}

export class FileTooLargeError extends AppError {
  constructor(message: string = 'File size exceeds maximum permitted limit of 50MB.') {
    super(413, 'FILE_TOO_LARGE', message);
  }
}

export class MalformedFileError extends AppError {
  constructor(message: string = 'Malformed or corrupted screenplay file. Failed to parse screenplay content.') {
    super(422, 'MALFORMED_FILE', message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(404, `${entity.toUpperCase()}_NOT_FOUND`, id ? `${entity} with ID '${id}' was not found.` : `${entity} not found.`);
  }
}

export class DatabaseNotConfiguredError extends AppError {
  constructor(message: string = 'Database not configured. PostgreSQL connection credentials not provided.') {
    super(503, 'DATABASE_NOT_CONFIGURED', message);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed.') {
    super(500, 'DATABASE_ERROR', message);
  }
}

export class NotConfiguredError extends AppError {
  constructor(component: string, message?: string) {
    super(
      501,
      'NOT_CONFIGURED',
      message || `${component} is not configured yet. This intelligence service will be implemented in a subsequent task.`
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required. Please provide valid credentials.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have authorization to access or modify this resource.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please wait a moment before trying again.') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

export class ConcurrencyLimitError extends AppError {
  constructor(message: string = 'Active analysis already in progress. Please wait for current analysis to complete.') {
    super(429, 'CONCURRENCY_LIMIT_EXCEEDED', message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = 'Service', message?: string) {
    super(503, 'SERVICE_UNAVAILABLE', message || `${service} is temporarily unavailable.`);
  }
}

