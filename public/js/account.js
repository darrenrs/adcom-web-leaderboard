const postFormInit = async() => {
  const playerId = document.querySelector('#playFabIdInitCheck').value
  
  const checkAccountStatus = await checkAccount(playerId)
  
  if (checkAccountStatus) {
    const saveCurrentId = document.querySelector('#playFabSetDefault')

    if (saveCurrentId.checked) {
      localStorage.setItem('playerId', playerId)
    } else {
      localStorage.removeItem('playerId')
    }

    document.querySelector('#accountCheckStatus').classList.add('d-none')
    document.querySelector('#mainContent').classList.remove('d-none')
  } else {
    // network failure
    document.querySelector('#accountCheckStatus').classList.remove('d-none')
    document.querySelector('#mainContent').classList.add('d-none')
  }
}

const postFormCreate = async() => {
  const playerId = document.querySelector('#playFabId').value
  const displayName = document.querySelector('#displayName').value
  const username = document.querySelector('#username').value
  const discordId = document.querySelector('#discordId').value
  
  const createAccountStatus = await createAccount(playerId, displayName, username, discordId)
  
  if (createAccountStatus) {
    // success
    document.querySelector('#accountManagementStatus').classList.remove('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-success')
    document.querySelector('#accountManagementStatus').classList.remove('text-danger')
    document.querySelector('#formSubmitAccount').classList.add('d-none')
    document.querySelector('#formPatchAccount').classList.remove('d-none')
    document.querySelector('#formDeleteAccount').classList.remove('d-none')
  } else {
    // duplicate or general failure
    document.querySelector('#accountManagementStatus').classList.remove('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-danger')
    document.querySelector('#accountManagementStatus').classList.remove('text-success')
    document.querySelector('#formSubmitAccount').classList.remove('d-none')
    document.querySelector('#formPatchAccount').classList.add('d-none')
    document.querySelector('#formDeleteAccount').classList.add('d-none')
  }
}

const postFormUpdate = async() => {
  const playerId = document.querySelector('#playFabId').value
  const displayName = document.querySelector('#displayName').value
  const username = document.querySelector('#username').value
  const discordId = document.querySelector('#discordId').value
  
  const createAccountStatus = await patchAccount(playerId, displayName, username, discordId)
  
  if (createAccountStatus) {
    // success
    document.querySelector('#accountManagementStatus').classList.remove('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-success')
    document.querySelector('#accountManagementStatus').classList.remove('text-danger')
  } else {
    // no user found or general failure
    document.querySelector('#accountManagementStatus').classList.remove('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-danger')
    document.querySelector('#accountManagementStatus').classList.remove('text-success')
  }
}

const postFormDelete = async() => {
  const playerId = document.querySelector('#playFabId').value
  
  const deleteAccountStatus = await deleteAccount(playerId)
  
  if (deleteAccountStatus) {
    // success
    document.querySelector('#accountManagementStatus').classList.remove('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-success')
    document.querySelector('#accountManagementStatus').classList.remove('text-danger')
    document.querySelector('#formSubmitAccount').classList.remove('d-none')
    document.querySelector('#formPatchAccount').classList.add('d-none')
    document.querySelector('#formDeleteAccount').classList.add('d-none')
  } else {
    // no user found or general failure
    document.querySelector('#accountManagementStatus').classList.add('d-none')
    document.querySelector('#accountManagementStatus').classList.add('text-danger')
    document.querySelector('#accountManagementStatus').classList.remove('text-success')
  }
}

const checkAccount = async(playFabId) => {
  const data = {
    "playFabId": playFabId
  }

  return await fetch('api/discord/account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 200) {
      response.json()
      .then((data) => {
        document.querySelector('#playFabId').value = data["id"]
        document.querySelector('#displayName').value = data["displayName"]
        document.querySelector('#username').value = data["username"]
        document.querySelector('#discordId').value = data["discordId"]
        document.querySelector('#formSubmitAccount').classList.add('d-none')
        document.querySelector('#formPatchAccount').classList.remove('d-none')
        document.querySelector('#formDeleteAccount').classList.remove('d-none')
        document.querySelector('#accountManagementStatus').classList.add('d-none')
      })
    } else if (response.status === 404) {
      document.querySelector('#playFabId').value = document.querySelector('#playFabIdInitCheck').value
      document.querySelector('#displayName').value = ""
      document.querySelector('#username').value = ""
      document.querySelector('#discordId').value = ""
      document.querySelector('#formSubmitAccount').classList.remove('d-none')
      document.querySelector('#formPatchAccount').classList.add('d-none')
      document.querySelector('#formDeleteAccount').classList.add('d-none')
      document.querySelector('#accountManagementStatus').classList.add('d-none')
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountCheckStatus').innerText = `Server error (${response.status})`
      return
    }
    return true
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#accountCheckStatus').innerText = 'Please check your internet connection'
    return
  })
}

const createAccount = async(playFabId, displayName, username, discordId) => {
  const data = {
    "playFabId": playFabId,
    "displayName": displayName,
    "username": username,
    "discordId": discordId
  }

  return await fetch('api/discord/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 201) {
      document.querySelector('#accountManagementStatus').innerText = `Successfully added ID ${playFabId}`
      return true
    } else if (response.status === 400) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Please check the validity of your inputs`
    } else if (response.status === 409) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `This account already exists`
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Server error (${response.status})`
    }
    return false
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#accountManagementStatus').innerText = 'Please check your internet connection'
    return
  })
}

const patchAccount = async(playFabId, displayName, username, discordId) => {
  const data = {
    "playFabId": playFabId,
    "displayName": displayName,
    "username": username,
    "discordId": discordId
  }

  return await fetch('api/discord/account', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 204) {
      document.querySelector('#accountManagementStatus').innerText = `Successfully updated ID ${playFabId}`
      return true
    } else if (response.status === 400) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Please check the validity of your inputs`
    } else if (response.status === 404) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `This account does not exist`
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Server error (${response.status})`
    }
    return false
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#accountManagementStatus').innerText = 'Please check your internet connection'
    return
  })
}

const deleteAccount = async(playFabId) => {
  const data = {
    "playFabId": playFabId
  }

  return await fetch('api/discord/account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 200) {
      document.querySelector('#accountManagementStatus').innerText = `Successfully deleted ID ${playFabId}`
      return true
    } else if (response.status === 400) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Please check the validity of your inputs`
    } else if (response.status === 404) {
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `This account does not exist`
    } else {  
      console.error(`Server error (${response.status})`)
      document.querySelector('#accountManagementStatus').innerText = `Server error (${response.status})`
    }
    return false
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#accountManagementStatus').innerText = 'Please check your internet connection'
    return
  })
}

// Function to handle the Enter key press event
function overrideDefaultEnter(event) {
  if (event.keyCode === 13) { // Check if Enter key was pressed
    event.preventDefault() // Prevent the default form submission

    // Get the first visible button in the form
    let buttons = document.querySelectorAll('#mainContent form button');
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].offsetParent !== null) { // Check if the button is visible
        buttons[i].click() // Trigger a click event on the button
        break;
      }
    }
  }
}

document.querySelector('#playFabIdInitCheck').addEventListener('keyup', function() {
  this.value = this.value.toUpperCase()
})

document.querySelector('#formInitAccount').addEventListener('click', function() {
  postFormInit()
})

document.querySelector('#mainContent form').addEventListener('keypress', function(event) {
  overrideDefaultEnter(event)
})

document.querySelector('#formSubmitAccount').addEventListener('click', function() {
  postFormCreate()
})

document.querySelector('#formPatchAccount').addEventListener('click', function() {
  postFormUpdate()
})

document.querySelector('#formDeleteAccount').addEventListener('click', function() {
  postFormDelete()
})

if (localStorage.getItem('playerId')) {
  let playerId = localStorage.getItem('playerId')
  document.querySelector('#playFabIdInitCheck').value = playerId
  document.querySelector('#playFabSetDefault').checked = true
}