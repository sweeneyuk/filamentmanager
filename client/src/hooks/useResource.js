import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with loading / error / ready states.
 * reload() after a success never goes back to 'loading'; a failed reload keeps the old data.
 */
export default function useResource(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, status: 'loading' });
  const hasData = useRef(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    if (!hasData.current) setState((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await loaderRef.current();
      if (id !== seq.current) return data;
      hasData.current = true;
      setState({ data, status: 'ready' });
      return data;
    } catch (err) {
      if (id === seq.current && !hasData.current) setState({ data: undefined, status: 'error', error: err });
      return undefined;
    }
  }, []);

  useEffect(() => {
    hasData.current = false;
    reload();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return { data: state.data, status: state.status, error: state.error, reload, setData };
}
