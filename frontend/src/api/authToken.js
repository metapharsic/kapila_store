let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function notifyUnauthorized() {
  if (onUnauthorized) onUnauthorized();
}
