import { useCallback } from 'react';
import axios from 'axios';
import useResource from './useResource';
import { formatMoney } from '../lib/format.js';

export default function useSettings() {
  const { data, status, reload, setData } = useResource(async () => (await axios.get('/api/settings')).data || {});
  const settings = data || {};
  const money = useCallback((value) => formatMoney(value, settings.currency), [settings.currency]);
  return { settings, money, status, reload, setData };
}
