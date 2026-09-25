/**
 * Safe Error Extraction Utility
 * Ensures that any error (AxiosError, plain object { code, message }, string, Error)
 * is always converted to a safe, user-friendly string and NEVER rendered directly as an object.
 */

export const formatErrorMessage = (err, fallback = 'An unexpected error occurred. Please try again.') => {
  if (!err) return fallback;
  if (typeof err === 'string') return err.trim() || fallback;

  if (typeof err === 'object') {
    // 1. Axios response data
    const resData = err.response?.data;
    if (resData) {
      if (typeof resData === 'string' && resData.trim()) return resData.trim();
      if (typeof resData.error === 'string' && resData.error.trim()) return resData.error.trim();
      if (resData.error && typeof resData.error === 'object') {
        if (typeof resData.error.message === 'string' && resData.error.message.trim()) {
          return resData.error.message.trim();
        }
        if (resData.error.code) {
          return `Error (${resData.error.code}): ${resData.error.message || 'Request failed'}`;
        }
      }
      if (typeof resData.message === 'string' && resData.message.trim()) return resData.message.trim();
      if (typeof resData.detail === 'string' && resData.detail.trim()) return resData.detail.trim();
      if (resData.code && resData.message) {
        return typeof resData.message === 'string' ? resData.message : `Error (${resData.code})`;
      }
    }

    // 2. Direct object with { code, message } or standard Error
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error.trim();
    }
    if (err.code && typeof err.code !== 'object') {
      return `Error (${err.code}): ${err.message || 'Operation failed'}`;
    }

    // 3. Fallback stringification
    try {
      const str = JSON.stringify(err);
      return str !== '{}' ? str : fallback;
    } catch (_) {
      return fallback;
    }
  }

  return String(err);
};
