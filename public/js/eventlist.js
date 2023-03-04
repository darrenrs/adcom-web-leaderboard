const getEventSchedule = async() => {
  return await fetch('/api/list/all')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      document.querySelector('#eventListLoadError').classList.remove('d-none')
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#eventListLoadError').classList.remove('d-none')
    return false
  })
}

const populateScheduleTable = (eventSchedule) => {
  let tbody = document.querySelector('#eventSchedule')

  for (let i in eventSchedule) {
    let eventRow = document.createElement('tr')
    const eventRecord = getEventDetails(eventSchedule[i]['eventName'])

    let idCell = document.createElement('td')
    idCell.innerText = eventSchedule.length - i

    let nameCell = document.createElement('td')
    if (eventRecord) {
      nameCell.innerText = eventRecord["name"]
    } else {
      nameCell.innerText = `NEW EVENT "${i["eventName"]}"`
    }
    nameCell.addEventListener('click', () => {
      let archiveString = ''
      const createDate = new Date(eventSchedule[i]["createdAt"])
      const archiveDate = new Date(eventSchedule[i]["archivedAt"])

      if (archiveDate.getFullYear() >= 1970) {
        archiveString = `\nAPI archived: ${archiveDate}`
      }

      const s = `Debug Information\nAPI created: ${createDate}${archiveString}\nEvent ID below`
      prompt(s, eventSchedule[i]["eventId"])
    })

    let dateFromCell = document.createElement('td')
    dateFromCell.innerText = new Date(eventSchedule[i]["startDate"]).toLocaleString()

    let dateToCell = document.createElement('td')
    dateToCell.innerText = new Date(eventSchedule[i]["endDate"]).toLocaleString()

    let durationCell = document.createElement('td')
    durationCell.innerText = `${(new Date(eventSchedule[i]["endDate"]) - new Date(eventSchedule[i]["startDate"])) / 3600000} hours`

    let playerCountCell = document.createElement('td')
    if (new Date(eventSchedule[i]["startDate"]) < new Date()) {
      playerCountCell.innerText = eventSchedule[i]["players"].toLocaleString()
    } else {
      playerCountCell.innerText = ''
    }

    eventRow.append(idCell)
    eventRow.append(nameCell)
    eventRow.append(dateFromCell)
    eventRow.append(dateToCell)
    eventRow.append(durationCell)
    eventRow.append(playerCountCell)
    
    tbody.appendChild(eventRow)
  }
}

const init = async() => {
  const eventSchedule = await getEventSchedule()

  populateScheduleTable(eventSchedule)
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})