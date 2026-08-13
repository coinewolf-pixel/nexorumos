export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function httpError(status: number, message: string): ApiError {
  return new ApiError(status, message);
}
