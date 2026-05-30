'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiUrl, type HistoryAlert } from '../../_types';

const PAGE_SIZE = 25;

async function fetchHistory(limit: number, offset: number): Promise<{ alerts: HistoryAlert[]; total: number }> {
  const res = await fetch(`${apiUrl}/alerts/history?limit=${limit}&offset=${offset}`);
  if (!res.ok) return { alerts: [], total: 0 };
  return res.json();
}

export function useHistorial() {
  const [history, setHistory] = useState<HistoryAlert[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const pageRef = useRef(historyPage);
  useEffect(() => { pageRef.current = historyPage; }, [historyPage]);

  const reloadHistory = useCallback(async (page = pageRef.current) => {
    setHistoryLoading(true);
    const h = await fetchHistory(PAGE_SIZE, page * PAGE_SIZE);
    setHistory(h.alerts);
    setHistoryTotal(h.total);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { reloadHistory(historyPage); }, [historyPage, reloadHistory]);

  const historyPageCount = useMemo(() => Math.max(1, Math.ceil(historyTotal / PAGE_SIZE)), [historyTotal]);
  return { history, historyTotal, historyLoading, historyPage, setHistoryPage, historyPageCount, reloadHistory };
}
