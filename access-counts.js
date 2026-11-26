(() => {
  const api = 'https://ouenka-base-data.ninzin5600.workers.dev/access-counts';
  const status = document.getElementById('siteAccessStatus');
  const fetchCounts = async (countView) => {
    try {
      const response = await fetch(api + (status && countView ? '?show=1' : ''), {
        method: countView ? 'POST' : 'GET',
        cache: 'no-store',
        keepalive: countView,
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw Error('HTTP ' + response.status);
      if (!status) return;
      const data = await response.json();
      if (!data.ok || !Number.isFinite(data.today) || !Number.isFinite(data.total)) throw Error('Invalid counts');
      document.getElementById('todayAccessCount').textContent = data.today.toLocaleString('ja-JP');
      document.getElementById('totalAccessCount').textContent = data.total.toLocaleString('ja-JP');
      status.textContent = '';
    } catch {
      if (status) status.textContent = 'アクセス数を取得できませんでした。';
    }
  };
  // A prerendered document counts only when it becomes visible to the visitor.
  if (document.prerendering) document.addEventListener('prerenderingchange', () => fetchCounts(true), {once: true});
  else fetchCounts(true);
  if (status) window.addEventListener('pageshow', event => {
    if (event.persisted) fetchCounts(false);
  });
})();
