const postFormPlayFab = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#playfabLoadStatus').classList.remove('d-none')
  document.querySelector('#playfabLoadStatus').innerText = 'Loading ...'

  const playerId = document.querySelector('#playfabSavedValue').innerText
  const userExists = await getPlayerState(playerId)

  if (userExists) {
    document.querySelector('#activePlayFabId').innerText = playerId
    
    // get player account value
    const userData = await getPlayerAccountValue(playerId)
    document.querySelector('#playfabLoadStatus').classList.add('d-none')
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
      document.querySelector('#playfabLoadStatus').innerText = `No account ${playerId} found.`
      return false
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#playfabLoadStatus').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#playfabLoadStatus').innerText = 'Please check your internet connection.'
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
      document.querySelector('#playfabLoadStatus').innerText = `Server error (${response.status})`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#playfabLoadStatus').innerText = 'Please check your internet connection.'
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

document.querySelector('#playfabLoadButton').addEventListener('click', function() {
  postFormPlayFab()
})