import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import AdminOrders from './AdminOrders';
import AdminGuestOrders from './AdminGuestOrders';
import { adminListGuestOrders } from '../../services/apiDelivery';
import config from '../../config/config';
import { PageHeader } from '../../components/admin/ui';

const LAST_SEEN_KEY = 'adminOrdersLastSeen';
const POLL_MS = 60000;

// seen[tab] = ISO time the tab was last opened. maxObserved[tab] = newest
// created_at ever returned for that tab. A row counts as new only if it is
// newer than BOTH — the second half matters because server timestamps can
// run ahead of this laptop's clock, which used to make the same rows look
// "new" on every poll so the badge never cleared after viewing.
const readMark = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_SEEN_KEY)) || {};
    if (raw.seen || raw.maxObserved) {
      return { seen: raw.seen || {}, maxObserved: raw.maxObserved || {} };
    }
    // Back-compat with the old flat { orders, guest } shape.
    return { seen: raw, maxObserved: {} };
  } catch {
    return { seen: {}, maxObserved: {} };
  }
};

const writeMark = (mark) => {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(mark));
  } catch {
    // private mode — badges just won't persist across reloads
  }
  return mark;
};

const maxCreatedAt = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((m, r) => {
    const t = r?.created_at ? new Date(r.created_at).getTime() : NaN;
    return Number.isNaN(t) ? m : Math.max(m, t);
  }, 0);

const countNewer = (rows, sinceIso, maxObservedIso) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  // First visit ever: nothing counts as unread, otherwise the badge screams
  // on day one about orders the admin has long since handled elsewhere.
  if (!sinceIso && !maxObservedIso) return 0;
  const floor = Math.max(
    sinceIso ? new Date(sinceIso).getTime() || 0 : 0,
    maxObservedIso ? new Date(maxObservedIso).getTime() || 0 : 0
  );
  return rows.filter((r) => r?.created_at && new Date(r.created_at).getTime() > floor).length;
};

export default function AdminOrdersHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'guest' ? 'guest' : 'orders';
  const [newCounts, setNewCounts] = useState({ orders: 0, guest: 0 });

  const refreshBadges = useCallback(async (markOverride) => {
    const mark = markOverride || readMark();
    const token = localStorage.getItem('adminToken');
    const results = { orders: 0, guest: 0 };
    let ordersRows = [];
    let guestRows = [];

    // Both fetches are first-page-only probes; a badge that occasionally
    // says 20 when the truth is 23 is fine, a page that hammers the API is not.
    await Promise.all([
      (async () => {
        try {
          const res = await fetch(
            `${config.getApiBaseUrl()}/admin/orders?status=all&page=1&per_page=20`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          ordersRows = data?.data?.data || [];
        } catch {
          /* badge only — never surface an error for this */
        }
      })(),
      (async () => {
        try {
          const data = await adminListGuestOrders({ page: 1, limit: 20 });
          guestRows = data?.orders || [];
        } catch {
          /* badge only — never surface an error for this */
        }
      })(),
    ]);

    // Remember the newest row ever observed per tab: once the admin's
    // browser has seen a row, no later poll may call it new again.
    const nextMax = { ...mark.maxObserved };
    for (const [tab, rows] of [['orders', ordersRows], ['guest', guestRows]]) {
      const newest = maxCreatedAt(rows);
      if (newest > 0) {
        const prev = nextMax[tab] ? new Date(nextMax[tab]).getTime() || 0 : 0;
        if (newest > prev) nextMax[tab] = new Date(newest).toISOString();
      }
    }

    // Count against the previously stored watermark — NOT nextMax, which
    // already includes this poll's rows and would always yield zero.
    results.orders = countNewer(ordersRows, mark.seen.orders, mark.maxObserved.orders);
    results.guest = countNewer(guestRows, mark.seen.guest, mark.maxObserved.guest);
    writeMark({ seen: mark.seen, maxObserved: nextMax });
    setNewCounts(results);
  }, []);

  // Mark the visible tab as seen (its badge clears), keep the other's badge live.
  useEffect(() => {
    const mark = readMark();
    mark.seen[activeTab] = new Date().toISOString();
    writeMark(mark);
    setNewCounts((prev) => ({ ...prev, [activeTab]: 0 }));
    refreshBadges(mark);
    const timer = setInterval(() => refreshBadges(), POLL_MS);
    return () => clearInterval(timer);
  }, [activeTab, refreshBadges]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    // Clear optimistically so the badge dies the instant the tab is opened,
    // not when the next fetch round-trips.
    setNewCounts((prev) => ({ ...prev, [tab]: 0 }));
    setSearchParams(tab === 'guest' ? { tab: 'guest' } : {}, { replace: false });
  };

  const tabs = [
    { key: 'orders', label: 'Orders' },
    { key: 'guest', label: 'Guest Orders' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardDocumentListIcon}
        title="Orders"
        subtitle="Renewal orders from registered users and guests"
      />
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(({ key, label }) => {
          const isActive = key === activeTab;
          const unread = !isActive ? newCounts[key] : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`relative -mb-px flex items-center gap-2 rounded-t-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border border-b-0 border-gray-200 bg-white text-[#2389E3]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
              {unread > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                  {unread >= 20 ? '20+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'guest' ? <AdminGuestOrders /> : <AdminOrders />}
    </div>
  );
}
