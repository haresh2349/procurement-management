export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: unknown[];
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const successResponse = <T>(data: T, message?: string): ApiSuccessResponse<T> => ({
  success: true,
  data,
  ...(message ? { message } : {}),
});

export const errorResponse = (
  message: string,
  code: string,
  errors?: unknown[],
): ApiErrorResponse => ({
  success: false,
  message,
  code,
  ...(errors ? { errors } : {}),
});
