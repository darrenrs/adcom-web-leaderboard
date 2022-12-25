const postFormPlayFab = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
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
    
    document.querySelector('#noAccountFound').classList.add('d-none')
    document.querySelector('#activePlayFabId').innerText = playerId

    // load event list
    await postFormEventList()
  } else {
    // no user found or general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
  }
}

const postFormEventList = async() => {
  // disable dropdown while we load, and show "loading" option
  const selectList = document.querySelector('#eventSelect')
  const countInput = document.querySelector('#eventNPlayers')
  const selectButton = document.querySelector('#formSubmitEvent')

  while (selectList.childElementCount > 0) {
    selectList.remove(selectList.lastChild)
  }

  const newOption = document.createElement('option')
  newOption.innerText = 'Please wait ...'
  selectList.appendChild(newOption)
  selectList.setAttribute('disabled', 'disabled')
  countInput.setAttribute('disabled', 'disabled')
  selectButton.setAttribute('disabled', 'disabled')

  const playerId = document.querySelector('#activePlayFabId').innerText
  const eventList = await getPlayerEventList(playerId)

  if (eventList) {
    selectList.removeAttribute('disabled')
    countInput.removeAttribute('disabled')
    selectButton.removeAttribute('disabled')

    const templateOption = document.querySelector('option')
    templateOption.remove()

    for (let i of eventList) {
      if (i["status"] && i["eventStatus"] === "active") {
        // the player participated in this event and the event is active
        const newOption = document.createElement('option')
        newOption.innerText = `${getEventDetails(i["eventName"])["short"]} (${new Date(i["startDate"]).toDateString().substring(4)} to ${new Date(i["endDate"]).toDateString().substring(4)})`
        newOption.value = i["eventId"]
        
        selectList.appendChild(newOption)
      }
    }

    if (selectList.childElementCount < 1) {
      // if after all this there have been no events found, we will restore the template message
      // it is possible for a PlayFab account to exist but no events to have been participated in
      const newOption = document.createElement('option')
      newOption.innerText = 'No event participation'
      selectList.appendChild(newOption)
      selectList.setAttribute('disabled', 'disabled')
      countInput.setAttribute('disabled', 'disabled')
      selectButton.setAttribute('disabled', 'disabled')
    }
  }
}

const postFormEventLeaderboard = async() => {
  const playerId = document.querySelector('#activePlayFabId').innerText
  const selectedEventId = document.querySelector('option:checked').value
  const topCount = document.querySelector('#eventNPlayers').value

  const topPlayers = await getTopPlayers(playerId, selectedEventId, topCount)
  
  if (topPlayers) {
    // success
    document.querySelector('#eventLoadConnectionError').classList.add('d-none')
    document.querySelector('#mainContent').classList.remove('d-none')
    populateFieldsTop(topPlayers)
  } else {
    // general failure
    document.querySelector('#eventLoadConnectionError').classList.remove('d-none')
    return
  }
}


const getPlayerState = async(playerId) => {
  return await fetch(`/api/player/${playerId}`)
  .then((response) => {
    if (response.status === 200) {
      return true
    } else {
      document.querySelector('#noAccountFound').innerText = `No account ${playerId} found.`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#noAccountFound').innerText = 'Please check your internet connection'
    return false
  })
}

const getPlayerEventList = async(playerId) => {
  return await fetch(`/api/list/${playerId}`)
    .then((response) => {
      return response.json()
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('option').innerText = 'Please check your internet connection'
      return
    })
}


const getTopPlayers = async(playerId, eventId, count) => {
  return await fetch(`/api/event/${eventId}/${playerId}/top/${count}`)
    .then((response) => {
      return response.json()
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#eventLoadConnectionError').innerText = 'Please check your internet connection'
      return
    })
}

const populateFieldsTop = (data) => {
  // implement in the future?
  /*
  const eventDetails = getEventDetails(currentEventId)
  document.querySelector('#eventImage').classList.remove('d-none')
  document.querySelector('#eventImage').setAttribute('src', `/img/adcom/${currentEventId}.png`)
  document.querySelector('#eventFullName').innerText = eventDetails["name"]
  document.querySelector('#eventDescription').innerText = eventDetails["desc"]
  document.querySelector('#eventStartDate').innerText = new Date(data["event"]["startDate"]).toLocaleString()
  document.querySelector('#eventEndDate').innerText = new Date(data["event"]["endDate"]).toLocaleString()
  document.querySelector('#eventDuration').innerText = `${(new Date(data["event"]["endDate"]) - new Date(data["event"]["startDate"])) / (60 * 60 * 1000)} hours`

  if (data["status"] === 'archived') {
    document.querySelector('#eventArchivedWarning').classList.remove('d-none')
  } else {
    document.querySelector('#eventArchivedWarning').classList.add('d-none')
  }
  */

  let tbody = document.querySelector('#topGlobalPlayers')
  tbody.innerHTML = ''
  for (let i in data["top"]["list"]) {
    let topPlayer = document.createElement('tr')
    if (data["top"]["list"][i]["playerId"] === document.querySelector('#activePlayFabId').innerText) {
      // bold the current player's line and add a trophy delta to the player above
      topPlayer.classList.add('fw-bold')

      if (i !== "0") {
        let trophyDelta = data["top"]["list"][i-1]["trophies"] - data["top"]["list"][i]["trophies"] + 10

        let moveUp = document.createElement('tr')
        moveUp.classList.add('fw-bold')
        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 4)
        moveUpCell.classList.add('text-center')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let positionCell = document.createElement('td')
    positionCell.innerText = parseInt(i) + 1

    let nameCell = document.createElement('td')
    nameCell.innerText = getPlayerNameFromOrdinal(data["top"]["list"][i]["ordinal"])

    let trophyCell = document.createElement('td')
    trophyCell.innerText = data["top"]["list"][i]["trophies"].toLocaleString()

    topPlayer.appendChild(positionCell)
    topPlayer.appendChild(nameCell)
    topPlayer.appendChild(trophyCell)
    
    tbody.appendChild(topPlayer)
  }
}

document.querySelector('#playFabQuery').addEventListener('keyup', function() {
  this.value = this.value.toUpperCase()
})

document.querySelector('#formSubmitPlayFab').addEventListener('click', function() {
  postFormPlayFab()
})

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormEventLeaderboard()
})

if (localStorage.getItem('playerId')) {
  let playerId = localStorage.getItem('playerId')
  document.querySelector('#playFabQuery').value = playerId
  document.querySelector('#playFabSetDefault').checked = true
}