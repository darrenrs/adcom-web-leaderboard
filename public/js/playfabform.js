const playfabSetup = () => {
  document.querySelector('#playfabSavedValue').innerText = localStorage.getItem('playerId');
  document.querySelector('#playfabSaved').classList.remove('d-none');

  if (window.location.pathname !== '/') {
    // index page doesn't have "Load Account" logic
    document.querySelector('#playfabLoadContainer').classList.remove('d-none');
  }

  if (!window.location.pathname.includes('account')) {
    // only hide PlayFab bar if not identity management page
    document.querySelector('#playfabFormContainer').classList.add('d-none');
  }
}

(async() => {
  if (Boolean(localStorage.getItem('playerId'))) {
    playfabSetup();
  };
  
  document.querySelector('#playfabForm').addEventListener('submit', () => {
    localStorage.setItem('playerId', document.querySelector('#playfabQuery').value);
    playfabSetup();
  });

  document.querySelector('#playfabQuery').addEventListener('keyup', function() {
    this.value = this.value.toUpperCase();
  });

  document.querySelector('#playfabLoadButton').addEventListener('click', function() {
    postFormPlayFab()
  });
})();