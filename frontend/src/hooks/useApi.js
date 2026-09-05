import { useState, useCallback } from "react";

// Wraps an API call with loading/error state
// usage: const { data, loading, error, run } = useApi(stock.list)
export function useApi(fn, initialData = null) {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn(...args);
      setData(res.data ?? res);
      return res;
    } catch (err) {
      setError(err.message || "Something went wrong");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { data, loading, error, run, setData };
}

// For paginated lists: tracks page, total, and merges pagination meta
export function usePaginatedApi(fn) {
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const fetch = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn({ ...params, page: params.page ?? page });
      setItems(res.data);
      setTotal(res.total);
      if (params.page) setPage(params.page);
      return res;
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [fn, page]);

  return { items, total, page, loading, error, fetch, setItems, setTotal };
}
