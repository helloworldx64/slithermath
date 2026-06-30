// Bootstrap. Loaded last (after all classes and UI).
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const account = new Account();

  // Prefill nickname input
  const inp = document.getElementById('nameInput');
  if (inp) inp.value = account.name;

  UI.init(account);

  window.GAME = new Game(canvas, account);

  // Hide loading, show menu
  UI.hideLoading();
  UI.show('menu');

  requestAnimationFrame((t) => GAME.tick(t));

  // Resume audio on first interaction (autoplay policy)
  const resumeAudio = () => { Audio.init(); window.removeEventListener('pointerdown', resumeAudio); };
  window.addEventListener('pointerdown', resumeAudio);
});