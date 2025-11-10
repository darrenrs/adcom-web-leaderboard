const invokeSideMenu = () => {
  document.querySelector('#sideMenu').style.left = '0';
}

const hideSideMenu = () => {
  document.querySelector('#sideMenu').style.left = '-250px';
}

document.querySelector('#sideMenuBtn').addEventListener('click', () => {
  if (document.querySelector('#sideMenu').classList.contains('side-menu-inactive')) {
    invokeSideMenu()
    document.querySelector('#sideMenu').classList.add('side-menu-active')
    document.querySelector('#sideMenu').classList.remove('side-menu-inactive')
  } else {
    hideSideMenu()
    document.querySelector('#sideMenu').classList.add('side-menu-inactive')
    document.querySelector('#sideMenu').classList.remove('side-menu-active')
  }
});

document.addEventListener('click', (event) => {
  const targetElementA = document.querySelector('#sideMenu'); 
  const targetElementB = document.querySelector('#sideMenuBtn');

  if (!targetElementA.contains(event.target) && !targetElementB.contains(event.target)) {
    hideSideMenu();
  }
});