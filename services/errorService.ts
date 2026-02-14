export const formatError = (error: any): string => {
  if (!error) return "An unknown error occurred.";
  
  if (typeof error === 'string') return error;
  
  if (error.message && typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    
    // Auth specific professional/secure messages
    if (msg.includes("invalid login credentials") || msg.includes("email not found") || msg.includes("invalid password")) {
      return "Incorrect email or password.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please verify your email before logging in.";
    }
    if (msg.includes("user already registered")) {
      return "An account with this email already exists.";
    }
    if (msg.includes("rate limit exceeded")) {
      return "Too many attempts. Please try again later.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }

    // Database missing table errors
    if (msg.includes("could not find the table") || msg.includes("schema cache")) {
      return "System configuration error. Please contact support.";
    }
    
    return error.message;
  }

  if (error.error_description && typeof error.error_description === 'string') {
    return error.error_description;
  }

  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    try {
      if (error.code && error.hint) {
        return `${error.message} (${error.hint})`;
      }
      const str = error.toString();
      if (str !== '[object Object]') return str;
      return error.msg || error.description || JSON.stringify(error);
    } catch (e) {
      return "An unexpected error occurred.";
    }
  }

  return String(error);
};

export const getAuthErrorMessage = (error: any): string => formatError(error);