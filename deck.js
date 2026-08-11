let current = 0;
const slides = document.querySelectorAll('.slide');
const total = slides.length;

function goTo(n) {
  slides[current].classList.remove('active');
  current = Math.max(0, Math.min(n, total - 1));
  slides[current].classList.add('active');
  document.getElementById('counter').textContent = `${current + 1} / ${total}`;
}

document.getElementById('prev').addEventListener('click', () => goTo(current - 1));
document.getElementById('next').addEventListener('click', () => goTo(current + 1));

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(current + 1); }
  if (e.key === 'ArrowLeft') goTo(current - 1);
  if (e.key === 'Home') goTo(0);
  if (e.key === 'End') goTo(total - 1);
});

let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
});

goTo(0);
