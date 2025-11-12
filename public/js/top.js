// MUST be global to reset the event listener
let eventSelectorListener

const postFormPlayFab = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#eventLoadConnectionError').classList.add('d-none')

  const playerId = document.querySelector('#playfabSavedValue').innerText
  const userExists = await getPlayerState(playerId)
  
  if (userExists) {
    document.querySelector('#playfabLoadStatus').classList.add('d-none')
    document.querySelector('#activePlayFabId').innerText = playerId

    // load event list
    await postFormEventList()
  } else {
    // no user found or general failure
    document.querySelector('#playfabLoadStatus').classList.remove('d-none')
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
  const eventListNoFilter = await getPlayerEventList(playerId)
  const eventList = eventListNoFilter.filter(x => x["eventStatus"] != 'archived')

  if (eventList) {
    selectList.removeAttribute('disabled')
    countInput.removeAttribute('disabled')
    selectButton.removeAttribute('disabled')

    if (eventSelectorListener) {
      selectList.removeEventListener('change', eventSelectorListener)
    }

    eventSelectorListener = nestedEventSelector(eventList.filter(element => element["status"]), selectList, selectButton)
  }
}

const postFormEventLeaderboard = async() => {
  // not a valid event if "level" attribute is present or "value" attribute is missing (check explicitly)
  if (document.querySelector('option:checked').getAttribute('level') !== null || document.querySelector('option:checked').getAttribute('value') === null) {
    return
  }
  
  const playerId = document.querySelector('#activePlayFabId').innerText
  const selectedEventId = document.querySelector('option:checked').value
  const topCount = document.querySelector('#eventNPlayers').value

  if (topCount > 1000) {
    return
  }

  const topPlayers = await getTopPlayers(playerId, selectedEventId, topCount)
  
  if (topPlayers) {
    // success
    document.querySelector('#playfabLoadStatus').classList.add('d-none')
    document.querySelector('#eventLoadConnectionError').classList.add('d-none')
    document.querySelector('#mainContent').classList.remove('d-none')

    const invalidBanner = await getInvalidState(selectedEventId)

    if (invalidBanner && invalidBanner !== "-1") {
      if (invalidBanner === '1') {
        document.querySelector('#exploitWarning').classList.remove('d-none')
        document.querySelector('#dataFidelityWarning').classList.add('d-none')
      } else if (invalidBanner === '2') {
        document.querySelector('#exploitWarning').classList.add('d-none')
        document.querySelector('#dataFidelityWarning').classList.remove('d-none')
      }
    } else {
      document.querySelector('#exploitWarning').classList.add('d-none')
      document.querySelector('#dataFidelityWarning').classList.add('d-none')
    }

    const iconList = await getIconListFetch()

    populateFieldsTop(topPlayers, iconList)
  } else {
    // general failure
    document.querySelector('#eventLoadConnectionError').classList.remove('d-none')
    return
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
    document.querySelector('#playfabLoadStatus').innerText = 'Please check your internet connection'
    return false
  })
}

const getPlayerEventList = async(playerId) => {
  return await fetch(`api/list/${playerId}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        document.querySelector('option').innerText = `Server error (${response.status})`
        return
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('option').innerText = 'Please check your internet connection'
      return
    })
}

const getTopPlayers = async(playerId, eventId, count) => {
  return await fetch(`api/event/${eventId}/${playerId}/top/${count}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        document.querySelector('#eventLoadConnectionError').innerText = `Server error (${response.status}).`
        return
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#eventLoadConnectionError').innerText = 'Please check your internet connection'
      return
    })
}

const getInvalidState = async(eventId) => {
  return await fetch(`api/event/${eventId}/lb-invalid`)
    .then((response) => {
      if (response.status === 200) {
        return response.text()
      } else {
        console.error(`Server error (${response.status})`)
        return
      }
    })
    .catch((error) => {
      console.error(error)
      return
    })
}


const populateFieldsTop = (data, iconList) => {
  const lteLiveSelectors = document.querySelectorAll('.live-lte');
  if (data["event"]["isLteLive"]) {
    for (let i of lteLiveSelectors) {
      i.classList.remove('d-none')
    }
  } else {
    for (let i of lteLiveSelectors) {
      i.classList.add('d-none')
    }
  }

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
        moveUpCell.setAttribute('colspan', 8)
        moveUpCell.classList.add('text-center', 'trophy-delta')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let positionCell = document.createElement('td')
    positionCell.innerText = parseInt(i) + 1

    let imageCell = document.createElement('td')
    imageCell.style = 'padding-top: 0 !important; padding-bottom: 0 !important; width: 0;'

    const playerNameProperties = getPlayerNameFromOrdinal(data["top"]["list"][i]["ordinal"])

    let image = document.createElement('img')
    
    image.src = `img/icons/v2/${iconList[data["top"]["list"][i]["avatarId"]]}.png`
    image.style = 'width: 40px; max-height: 40px;'
    image.alt = '' // don't add a value to this or it'll look ugly
    imageCell.appendChild(image)

    let nameCell = document.createElement('td')
    nameCell.innerText = playerNameProperties["defaultName"]

    let trophyCell = document.createElement('td')
    trophyCell.innerText = data["top"]["list"][i]["trophies"].toLocaleString()

    let amountSpentCell = document.createElement('td')
    amountSpentCell.innerText = getSpendingCategory(data["top"]["list"][i]["divisionId"])
    
    let divisionOrdinalIdCell = document.createElement('td')
    divisionOrdinalIdCell.innerText = getDivisionSuffix(data["top"]["list"][i]["divisionId"])
    divisionOrdinalIdCell.classList.add('table-value-quant')

    let timeElapsedCell = document.createElement('td')
    timeElapsedCell.innerHTML = getFastTimedeltaFormat((new Date(data["top"]["list"][i]["endTime"]) - new Date(data["top"]["list"][i]["startTime"]))/1000)

    topPlayer.appendChild(positionCell)
    topPlayer.appendChild(imageCell)
    topPlayer.appendChild(nameCell)
    topPlayer.appendChild(trophyCell)

    if (data["event"]["isLteLive"]) {
      let rankCell = document.createElement('td')
      rankCell.innerText = data["top"]["list"][i]["lteRank"]
      topPlayer.appendChild(rankCell)
    }

    topPlayer.appendChild(amountSpentCell)
    topPlayer.appendChild(divisionOrdinalIdCell)
    topPlayer.appendChild(timeElapsedCell)
    
    tbody.appendChild(topPlayer)
  }
}

document.querySelector('#formSubmitEvent').addEventListener('click', function() {
  postFormEventLeaderboard()
})