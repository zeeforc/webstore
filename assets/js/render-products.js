// /assets/js/render-products.js
(async function () {
  const target = document.querySelector('.card-list');
  if (!target) return;

  const formatIDR = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

  try {
    // langsung ke file JSON statis (tanpa API)
    const res = await fetch('/assets/data/products.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuat data produk');
    const data = await res.json();

    // Hapus konten hardcoded kalau mau full dynamic
    target.innerHTML = '';

    for (const p of data.products) {
      const card = document.createElement('div');
      card.className = 'card';

      // fallback kelas badge (beberapa card lo pakai .badge-wetv)
      const badgeClass = p.badgeClass || 'badge';

      card.innerHTML = `
        <div class="${badgeClass}">
          <img src="${p.logo}" alt="${p.title} Logo" />
        </div>
        <h2 class="title">${p.title}</h2>
        <div class="underline"></div>
        <div class="bar">
          <span class="left">${p.periodLabelLeft || 'PAKET'}</span>
          <span class="right">${p.periodLabelRight || ''}</span>
        </div>
        <ul class="list">
          ${(p.packages || []).map(item => `
            <li class="item">
              <span>${item.name}</span>
              <span class="price">${formatIDR(item.price)}</span>
            </li>
          `).join('')}
        </ul>
      `;
      target.appendChild(card);
    }
  } catch (err) {
    console.error('[render-products]', err);
    // fallback: biarin konten hardcoded tampil apa adanya
  }
})();
