const postFormAdmin = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#adminLoginStatus').classList.remove('d-none')
  document.querySelector('#adminLoginStatus').innerText = 'Loading ...'

  const playerData = await getAdmin()

  if (!playerData) {
    document.querySelector('#adminLoginStatus').classList.remove('d-none')
    return
  }

  document.querySelector('#adminControlPassIcon').value = document.querySelector('#adminControlPass').value
  populateAdmin(playerData)
}

const getAdmin = async() => {
  const data = {
    "password": document.querySelector('#adminControlPass').value
  }

  return await fetch('api/admin', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else if (response.status === 401) {
      document.querySelector('#adminLoginStatus').innerText = `Incorrect password`
      return
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#adminLoginStatus').innerText = `Server error (${response.status})`
      return
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#adminLoginStatus').innerText = 'Please check your internet connection'
    return
  })
}

const populateAdmin = async(data) => {
  document.querySelector('#mainContent').classList.remove('d-none')

  document.querySelector('#discordLeaderboardCount').innerText = (data["discordLeaderboard"].length).toLocaleString()
  document.querySelector('#discordLeaderboardIconCount').innerText = (data["discordLeaderboardIcons"].length).toLocaleString()
  document.querySelector('#dbPlayerCount').innerText = (data["dbPlayerList"].length).toLocaleString()
  document.querySelector('#dbPlayerEventRecordCount').innerText = (data["dbPlayerEventRecords"].length).toLocaleString()

  const tbodyDiscord = document.querySelector('#discordLeaderboardRaw')
  const allExistingRowsDiscord = document.querySelectorAll('#discordLeaderboardRaw tr')
  
  for (let i of allExistingRowsDiscord) {
    i.remove()
  }

  for (let i in data["discordLeaderboard"]) {
    let discordLbRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i)

    let nameCell = document.createElement('td')
    nameCell.innerText = data["discordLeaderboard"][i]["displayName"]

    let discordNameCell = document.createElement('td')
    discordNameCell.innerText = data["discordLeaderboard"][i]["username"]

    let discordIdCell = document.createElement('td')
    discordIdCell.innerText = data["discordLeaderboard"][i]["discordId"]
    discordIdCell.classList.add('font-monospace')

    let playFabIdCell = document.createElement('td')
    playFabIdCell.innerText = data["discordLeaderboard"][i]["id"]
    playFabIdCell.classList.add('font-monospace')

    let lastLoginCell = document.createElement('td')
    lastLoginCell.innerText = data["discordLeaderboard"][i]["lastCheckDate"]

    discordLbRow.append(idCell)
    discordLbRow.append(nameCell)
    discordLbRow.append(discordNameCell)
    discordLbRow.append(discordIdCell)
    discordLbRow.append(playFabIdCell)
    discordLbRow.append(lastLoginCell)
    
    tbodyDiscord.appendChild(discordLbRow)
  }

  // ---------- //


  const tbodyDiscordIcon = document.querySelector('#discordLeaderboardIconDesc')
  const allExistingRowsDiscordIcon = document.querySelectorAll('#discordLeaderboardIconDesc tr')
  
  for (let i of allExistingRowsDiscordIcon) {
    i.remove()
  }

  for (let i in data["discordLeaderboardIcons"]) {
    let discordIconRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = data["discordLeaderboardIcons"][i]["id"]
    idCell.classList.add('font-monospace')

    let displayName = document.createElement('td')
    let description = document.createElement('td')

    for (let j in data["discordLeaderboard"]) {
      if (data["discordLeaderboardIcons"][i]["id"] === data["discordLeaderboard"][j]["discordId"]) {
        displayName.innerText = data["discordLeaderboard"][j]["displayName"]
        description.innerText = data["discordLeaderboard"][j]["iconQualitativeDesc"]
        displayName.classList.remove('fst-italic')
        break
      }

      displayName.innerText = "unknown"
      displayName.classList.add('fst-italic')
    }

    let status = document.createElement('td')
    status.innerHTML = data["discordLeaderboardIcons"][i]["exists"] ? "Exists" : "<strong>Missing</strong>"

    discordIconRow.append(idCell)
    discordIconRow.append(displayName)
    discordIconRow.append(description)
    discordIconRow.append(status)

    tbodyDiscordIcon.append(discordIconRow)
  }

  // ---------- //

  const tbodyPlayerList = document.querySelector('#dbPlayerList')
  const allExistingRowsPlayerList = document.querySelectorAll('#dbPlayerList tr')
  
  for (let i of allExistingRowsPlayerList) {
    i.remove()
  }

  for (let i in data["dbPlayerList"]) {
    let dbPlayerListRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i)

    let playFabIdCell = document.createElement('td')
    playFabIdCell.innerText = data["dbPlayerList"][i]["id"]
    playFabIdCell.classList.add('font-monospace')

    let addDateCell = document.createElement('td')
    addDateCell.innerText = data["dbPlayerList"][i]["addDate"]

    dbPlayerListRow.append(idCell)
    dbPlayerListRow.append(playFabIdCell)
    dbPlayerListRow.append(addDateCell)
    
    tbodyPlayerList.appendChild(dbPlayerListRow)
  }

  // ---------- //
  /*
  const tbodyEventRecords = document.querySelector('#dbPlayerEventRecords')
  const allExistingRowsEventRecords = document.querySelectorAll('#dbPlayerEventRecords tr')
  
  for (let i of allExistingRowsEventRecords) {
    i.remove()
  }

  for (let i in data["dbPlayerEventRecords"]) {
    let dbPlayerEventRecordRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i)

    let playFabIdCell = document.createElement('td')
    playFabIdCell.innerText = data["dbPlayerEventRecords"][i]["id"]
    playFabIdCell.classList.add('font-monospace')

    let eventIdCell = document.createElement('td')
    eventIdCell.innerText = data["dbPlayerEventRecords"][i]["eventId"]
    eventIdCell.classList.add('font-monospace')

    let statusCell = document.createElement('td')
    statusCell.innerText = data["dbPlayerEventRecords"][i]["exists"] ? "true" : "false"

    let addDateCell = document.createElement('td')
    addDateCell.innerText = data["dbPlayerEventRecords"][i]["addDate"]

    dbPlayerEventRecordRow.append(idCell)
    dbPlayerEventRecordRow.append(playFabIdCell)
    dbPlayerEventRecordRow.append(eventIdCell)
    dbPlayerEventRecordRow.append(statusCell)
    dbPlayerEventRecordRow.append(addDateCell)
    
    tbodyEventRecords.appendChild(dbPlayerEventRecordRow)
  }
  */

  document.querySelector('#adminLoginStatus').classList.add('d-none')
}

document.querySelector('#formSubmitAdmin').addEventListener('click', function() {
  postFormAdmin()
})