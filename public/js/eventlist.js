const getEventSchedule = async() => {
  return await fetch('api/list/all')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#eventListLoadError').innerText = `Server error (${response.status}).`
      document.querySelector('#eventListLoadError').classList.remove('d-none')
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#eventListLoadError').innerText = 'Please check your internet connection.'
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
      nameCell.innerText = `NEW EVENT "${eventSchedule[i]["eventName"]}"`
    }
    nameCell.addEventListener('click', () => {
      let archiveString = 'N/A'
      const createDate = new Date(eventSchedule[i]["createdAt"])
      const archiveDate = new Date(eventSchedule[i]["archivedAt"])

      if (archiveDate.getFullYear() >= 1970) {
        archiveString = `${archiveDate}`
      }

      const s = `<li><strong>Event ID:</strong> <span id="eid" class="font-monospace" style="font-size: 14px;">${eventSchedule[i]["eventId"]}</span></li>
      <li><strong>Internal Name:</strong> ${eventSchedule[i]["eventName"]}</li>
      <li><strong>API Created:</strong> ${createDate}</li>
      <li><strong>API Archived:</strong> ${archiveString}</li>
      <li><strong>Real Players:</strong> ${eventSchedule[i]["players"].toLocaleString()}</li>`

      document.querySelector('#eventDebugInfo').innerHTML = s

      $('#modal').modal('toggle')
    })

    let dateFromCell = document.createElement('td')
    dateFromCell.innerText = new Date(eventSchedule[i]["startDate"]).toLocaleString()

    let dateToCell = document.createElement('td')
    dateToCell.innerText = new Date(eventSchedule[i]["endDate"]).toLocaleString()

    let durationCell = document.createElement('td')
    durationCell.innerText = `${(new Date(eventSchedule[i]["endDate"]) - new Date(eventSchedule[i]["startDate"])) / 3600000} hours`

    let playerCountCell = document.createElement('td')
    if (new Date(eventSchedule[i]["startDate"]) < new Date()) {
      if (!eventSchedule[i]["players"]) {
        playerCountCell.innerText = '0'
      } else {
        playerCountCell.innerText = eventSchedule[i]["players"].toLocaleString()
      }
    } else {
      playerCountCell.innerText = ''
    }

    let statusCodeCell = document.createElement('td')
    if (new Date(eventSchedule[i]["archivedAt"]).getFullYear() >= 1970) {
      statusCodeCell.innerText = "A"
    } else if (new Date(eventSchedule[i]["startDate"]) > new Date()) {
      statusCodeCell.innerText = "F"
    } else {
      statusCodeCell.innerText = "C"
    }

    eventRow.append(idCell)
    eventRow.append(nameCell)
    eventRow.append(dateFromCell)
    eventRow.append(dateToCell)
    eventRow.append(durationCell)
    eventRow.append(playerCountCell)
    eventRow.append(statusCodeCell)
    
    tbody.appendChild(eventRow)
  }

  document.querySelector('table').classList.remove('d-none')
}

const init = async() => {
  const tzs = Intl.DateTimeFormat().resolvedOptions().timeZone
  document.querySelector('#tzs').innerText = `TZ: ${tzs}`

  const eventSchedule = await getEventSchedule()

  if (eventSchedule) {
    populateScheduleTable(eventSchedule)
  }
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#copyEventId').addEventListener('click', async function() {
  const eid = document.querySelector('#eid').innerText
  
  try {
    await navigator.clipboard.writeText(eid);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
})