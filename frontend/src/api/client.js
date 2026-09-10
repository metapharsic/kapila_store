import { clearAccessToken, getAccessToken, notifyUnauthorized, setAccessToken } from "./authToken";

const BASE = import.meta.env.VITE_API_URL || "/api";

function absoluteUrl(path) {
  const absoluteBase = BASE.startsWith("http") ? BASE : window.location.origin + BASE;
  return new URL(absoluteBase + path);
}

async function parseJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const errorText = await res.text();
    throw new Error(`Server returned non-JSON response. Status: ${res.status}. ${errorText.slice(0, 100)}`);
  }
  return res.json();
}

let refreshPromise = null;
async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(absoluteUrl("/auth/refresh"), {
        method: "POST",
        credentials: "include",
      });
      const json = await parseJson(res);
      if (!json.success) throw new Error(json.error || "Session refresh failed");
      setAccessToken(json.data.accessToken);
      return json.data;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(method, path, body, params, didRetry = false) {
  const url = absoluteUrl(path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      "x-api-key": import.meta.env.VITE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !didRetry && path !== "/auth/login" && path !== "/auth/refresh") {
    try {
      await refreshAccessToken();
      return request(method, path, body, params, true);
    } catch {
      clearAccessToken();
      notifyUnauthorized();
    }
  }

  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error || "Request failed");
  return json;
}

export const api = {
  get: (path, params) => request("GET", path, null, params),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path, body) => request("DELETE", path, body),

  postUpload: async (path, formData) => {
    const res = await fetch(absoluteUrl(path), {
      method: "POST",
      credentials: "include",
      headers: {
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        "x-api-key": import.meta.env.VITE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || "",
      },
      body: formData,
    });
    const json = await parseJson(res);
    if (!json.success) throw new Error(json.error || "Upload failed");
    return json;
  },

  download: async (path, params, defaultFilename = "report.xlsx", didRetry = false) => {
    const url = absoluteUrl(path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
      });
    }
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        "x-api-key": import.meta.env.VITE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || "",
      },
    });

    if (res.status === 401 && !didRetry) {
      try {
        await refreshAccessToken();
        return api.download(path, params, defaultFilename, true);
      } catch {
        clearAccessToken();
        notifyUnauthorized();
      }
    }

    if (!res.ok) {
      let errText = `Download failed (${res.status})`;
      try {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          errText = json.error || json.message || errText;
        } catch {
          // If HTML error or raw string, extract first 120 chars cleanly
          const cleanText = text.replace(/<[^>]*>/g, "").trim();
          errText = cleanText ? cleanText.slice(0, 120) : errText;
        }
      } catch {
        errText = `Download failed with HTTP ${res.status}`;
      }
      throw new Error(errText);
    }

    const disposition = res.headers.get("content-disposition");
    let filename = defaultFilename;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1].trim();
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    return { success: true, filename };
  },
};
