const postFormAccountValue = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#loadStatus').classList.remove('d-none')
  document.querySelector('#loadStatus').innerText = 'Loading ...'

  const playerId = document.querySelector('#playFabQuery').value
  const saveCurrentId = document.querySelector('#playFabSetDefault')
  
  const userExists = await getPlayerState(playerId)

  if (userExists) {
    // success
    if (saveCurrentId.checked) {
      localStorage.setItem('playerId', playerId)
    } else {
      localStorage.removeItem('playerId')
    }
    
    document.querySelector('#activePlayFabId').innerText = playerId
    
    // get player account value
    const userData = await getPlayerAccountValue(playerId)
    document.querySelector('#loadStatus').classList.add('d-none')
    populateAccountValue(userData)
  } else {
    // no user found or general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
  }
}

const getPlayerState = async(playerId) => {
  return await fetch(`api/player/${playerId}`)
  .then((response) => {
    if (response.status === 200) {
      return true
    } else if (response.status === 404) {
      document.querySelector('#loadStatus').innerText = `No account ${playerId} found.`
      return false
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#loadStatus').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#loadStatus').innerText = 'Please check your internet connection.'
    return false
  })
}

const getPlayerAccountValue = async(playerId) => {
  return await fetch(`api/player/${playerId}/accountvalue`)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#loadStatus').innerText = `Server error (${response.status})`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#loadStatus').innerText = 'Please check your internet connection.'
    return false
  })
}

const populateAccountValue = (data) => {
  document.querySelector('#mainContent').classList.remove('d-none')

  const dateAccountGenesis = new Date(data["dateAccountGenesis"])
  const dateAccountLastLogin = new Date(data["dateAccountLastLogin"])

  document.querySelector('#accountValueUSD').innerText = getUsdValueFmt(data["accountValueUSD"])
  document.querySelector('#accountValueQualitativeDescriptor').innerHTML = `(${getUsdValueQualitativeDescriptor(data["accountValueUSD"])})`
  document.querySelector('#dateAccountGenesis').innerText = dateAccountGenesis.toLocaleString()
  document.querySelector('#timeSinceAccountGenesis').innerHTML = `(${getTimedeltaFormat(dateAccountGenesis)} ago)`
  document.querySelector('#dateAccountLastLogin').innerText = dateAccountLastLogin.toLocaleString()
  document.querySelector('#timeSinceAccountLastLogin').innerHTML = `(${getTimedeltaFormat(dateAccountLastLogin)} ago)`
}

const init = async() => {
  if (localStorage.getItem('playerId')) {
    let playerId = localStorage.getItem('playerId')
    document.querySelector('#playFabQuery').value = playerId
    document.querySelector('#playFabSetDefault').checked = true
  }
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formSubmitPlayFab').addEventListener('click', function() {
  postFormAccountValue()
})

document.querySelector('#playFabQuery').addEventListener('keyup', function() {
  this.value = this.value.toUpperCase()
})