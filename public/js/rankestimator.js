const getEventSchedule = async() => {
  return await fetch('api/list')
  .then((response) => {
    if (response.status === 200) {
      return response.json()
    } else {
      console.error(`Server error (${response.status})`)
      document.querySelector('#checkRankStatus').innerText = `Server error (${response.status}).`
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#checkRankStatus').innerText = `Please check your internet connection.`
    return false
  })
}

const getRankEstimate = async(eventId, trophies, startTime, endTime) => {
  const timeSeconds = (endTime.getTime() - startTime.getTime()) / 1000

  return await fetch(`api/event/${eventId}/rank-estimator?trophies=${trophies}&time=${timeSeconds}`)
    .then((response) => {
      if (response.status === 200) {
        return response.json()
      } else {
        console.error(`Server error (${response.status})`)
        document.querySelector('#checkRankStatus').innerText = `Server error (${response.status}).`
        return
      }
    })
    .catch((error) => {
      console.error(error)
      document.querySelector('#checkRankStatus').innerText = `Please check your internet connection.`
      return
    })
}

const init = async() => {
  const eventSchedule = await getEventSchedule()

  if (!eventSchedule) {77
    document.querySelector('#checkRankStatus').classList.remove('d-none')
    return
  }

  const activeEventId = eventSchedule[0]["eventId"]
  document.querySelector('#activeEventId').value = activeEventId
  
  document.querySelector('#startTimeInput').value = eventSchedule[0]["startDate"].replace('Z', '')

  if (new Date(eventSchedule[0]["endDate"]) > new Date()) {
    document.querySelector('#endTimeInput').value = new Date().toISOString().slice(0, -8)
  } else {
    document.querySelector('#endTimeInput').value = eventSchedule[0]["endDate"].replace('Z', '')
  }
}

document.addEventListener('DOMContentLoaded', function() {
  init()
})

document.querySelector('#formCheckRank').addEventListener('click', async function() {
  const eventId = document.querySelector('#activeEventId').value
  const trophies = document.querySelector('#trophyInput').value
  const startTimeInput = document.querySelector('#startTimeInput').value
  const endTimeInput = document.querySelector('#endTimeInput').value

  const startTimeUTC = new Date(`${startTimeInput}:00Z`)
  const endTimeUTC = new Date(`${endTimeInput}:00Z`)
  
  const rankEstimate = await getRankEstimate(eventId, trophies, startTimeUTC, endTimeUTC)

  if (!rankEstimate) {
    document.querySelector('#checkRankStatus').classList.remove('d-none')
    return
  } else {
    document.querySelector('#checkRankStatus').classList.add('d-none')
  }

  const rankString = `${rankEstimate["rank"]}/${rankEstimate["mission"]}`
  document.querySelector('#output').innerText = rankString
})