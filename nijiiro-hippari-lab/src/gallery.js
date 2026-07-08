// できた もようを カードにして まどかざりに
const KEY = 'nijiiro.cards.v1';
const MAX_CARDS = 12;

export function captureCard(sourceCanvas) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const size = 560;
  const c = document.createElement('canvas');
  // 中央を正方形に切りぬく
  const s = Math.min(w, h);
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.drawImage(sourceCanvas, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.82);
}

export function loadCards() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function saveCard(dataUrl) {
  const cards = loadCards();
  cards.unshift({ img: dataUrl, at: Date.now() });
  while (cards.length > MAX_CARDS) cards.pop();
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    // 容量オーバーなら古いのを消してもう一度
    while (cards.length > 4) cards.pop();
    try { localStorage.setItem(KEY, JSON.stringify(cards)); } catch { /* あきらめる */ }
  }
  return cards;
}

export function deleteCard(index) {
  const cards = loadCards();
  cards.splice(index, 1);
  localStorage.setItem(KEY, JSON.stringify(cards));
  return cards;
}
