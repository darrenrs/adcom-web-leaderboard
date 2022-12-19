async function postForm() {
  let playerId = document.querySelector('#playFabQuery').value
  let saveCurrentId = document.querySelector('#playFabSetDefault')
  
  let userData = await getUserData(playerId)
  
  if (userData) {
    // success
    if (saveCurrentId.checked) {
      localStorage.setItem('playerId', playerId)
    } else {
      localStorage.removeItem('playerId')
    }
    
    document.querySelector('#noAccountFound').classList.add('d-none')
    populateFields(userData)
  } else {
    // no user found or general failure
    document.querySelector('#noAccountFound').classList.remove('d-none')
  }
}

async function getUserData(playerId) {
  return await fetch(`/api/event/now/${playerId}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        document.querySelector('#noAccountFound').innerText = `No account ${playerId} found for this event`
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#noAccountFound').innerText = 'Please check your internet connection'
    })
}

function populateFields(data) {
  document.querySelector('#playerName').innerText = getPlayerNameFromOrdinal(data["player"]["playerOrdinal"])
  document.querySelector('#globalPosition').innerText = `${(data["player"]["globalPosition"]+1).toLocaleString()} / ${data["global"]["count"].toLocaleString()}`
  document.querySelector('#globalPositionPercentile').innerText = `Top ${(data["player"]["globalPosition"] / (data["global"]["count"]-1) * 100).toFixed(2)}%`
  document.querySelector('#joinDate').innerText = new Date(data["player"]["dateJoined"]).toLocaleString()
  document.querySelector('#updateDate').innerText = new Date(data["player"]["dateUpdated"]).toLocaleString()
  document.querySelector('#divisionId').innerText = data["player"]["divisionId"]
  document.querySelector('#divisionType').innerText = getSpendingCategory(data["player"]["divisionId"])
  document.querySelector('#leaderboardType').innerText = getLeaderboardType(data["player"]["divisionRoot"])

  let tbody = document.querySelector('#divisionPlayers')
  tbody.innerHTML = ''
  for (i in data["division"]["top"]) {
    let divisionPlayer = document.createElement('tr')
    if (data["division"]["top"][i]["ordinal"] === data["player"]["playerOrdinal"]) {
      // bold the current player's line and add a trophy delta to the player above
      divisionPlayer.classList.add('fw-bold')

      if (i !== "0") {
        let trophyDelta = data["division"]["top"][i-1]["trophies"] - data["division"]["top"][i]["trophies"] + 10

        let moveUp = document.createElement('tr')
        let moveUpCell = document.createElement('td')
        moveUpCell.setAttribute('colspan', 3)
        moveUpCell.classList.add('text-center')
        moveUpCell.innerText = `▲ ${trophyDelta.toLocaleString()} trophies needed to move up ▲`

        moveUp.appendChild(moveUpCell)
        tbody.appendChild(moveUp)
      }
    }

    let positionCell = document.createElement('td')
    positionCell.innerText = parseInt(i) + 1

    let nameCell = document.createElement('td')
    nameCell.innerText = getPlayerNameFromOrdinal(data["division"]["top"][i]["ordinal"])

    let trophyCell = document.createElement('td')
    trophyCell.innerText = data["division"]["top"][i]["trophies"].toLocaleString()

    divisionPlayer.appendChild(positionCell)
    divisionPlayer.appendChild(nameCell)
    divisionPlayer.appendChild(trophyCell)
    
    tbody.appendChild(divisionPlayer)
  }
}

document.querySelector('#formSubmit').addEventListener('click', function() {
  postForm()
})

if (localStorage.getItem('playerId')) {
  let playerId = localStorage.getItem('playerId')
  document.querySelector('#playFabQuery').value = playerId
  document.querySelector('#playFabSetDefault').checked = true
  postForm()
}