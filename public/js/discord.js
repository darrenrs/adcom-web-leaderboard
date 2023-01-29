const getEventSchedule = async() => {
  return await fetch('/api/list')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
    return false
  })
}

const getDiscordLeaderboard = async(eventId) => {
  return await fetch(`/api/discord/${eventId}`)
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#discordLeaderboardLoadError').innerText = 'Please check your internet connection.'
    return false
  })
}

const populateDiscordLeaderboardTable = (discordLb) => {
  let tbody = document.querySelector('#discordLeaderboard')

  for (let i in discordLb) {
    let discordLbRow = document.createElement('tr')

    let idCell = document.createElement('td')
    idCell.innerText = parseInt(i) + 1

    let nameCell = document.createElement('td')
    nameCell.innerText = discordLb[i]["name"]

    let discordNameCell = document.createElement('td')
    discordNameCell.innerText = discordLb[i]["discordName"]

    let positionCell = document.createElement('td')
    positionCell.innerText = `${discordLb[i]["position"].toLocaleString()} / ${discordLb[i]["positionOf"].toLocaleString()}`

    let trophiesCell = document.createElement('td')
    trophiesCell.innerText = discordLb[i]["trophies"].toLocaleString()

    let lastUpdatedCell = document.createElement('td')
    lastUpdatedCell.innerText = new Date(discordLb[i]["lastUpdated"]).toLocaleString()

    discordLbRow.append(idCell)
    discordLbRow.append(nameCell)
    discordLbRow.append(discordNameCell)
    discordLbRow.append(positionCell)
    discordLbRow.append(trophiesCell)
    discordLbRow.append(lastUpdatedCell)
    
    tbody.appendChild(discordLbRow)
  }

  document.querySelector('#discordLeaderboardLoadError').classList.add('d-none')
}

const init = async() => {
  const eventSchedule = await getEventSchedule()

  console.log(`Current event ID: ${eventSchedule[0]["eventId"]}`)

  const playerData = await getDiscordLeaderboard(eventSchedule[0]["eventId"])

  populateDiscordLeaderboardTable(playerData)
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})