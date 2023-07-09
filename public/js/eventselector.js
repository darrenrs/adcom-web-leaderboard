const nestedEventSelector = (data, selectList, selectButton) => {
  const clearList = () => {
    while (selectList.childElementCount > 0) {
      selectList.remove(selectList.lastChild)
    }
  }

  const loadByLevel = (arg) => {
    if (level === 0) {
      loadBase()
    } else if (level === 1) {
      loadSubBase(arg)
    } else if (level === 2) {
      loadSelect(arg)
    } else {
      return
    }
  }

  const loadBase = () => {
    clearList()

    const optionCurrent = document.createElement('option')
    optionCurrent.innerText = `Most Recent Event: ${getEventDetails(data[0]["eventName"])["short"]} (${new Date(data[0]["startDate"]).toDateString().substring(4)} to ${new Date(data[0]["endDate"]).toDateString().substring(4)})`
    optionCurrent.value = data[0]["eventId"]
    selectList.appendChild(optionCurrent)

    if (data.length > 1) {
      const optionPrevious = document.createElement('option')
      optionPrevious.innerText = `Previously Recent Event: ${getEventDetails(data[1]["eventName"])["short"]} (${new Date(data[1]["startDate"]).toDateString().substring(4)} to ${new Date(data[1]["endDate"]).toDateString().substring(4)})`
      optionPrevious.value = data[1]["eventId"]
      selectList.appendChild(optionPrevious)
    }

    const optionYear = document.createElement('option')
    optionYear.innerText = 'Select by Year'
    optionYear.value = 'year'
    optionYear.setAttribute('level', 1)
    selectList.appendChild(optionYear)

    const optionMonth = document.createElement('option')
    optionMonth.innerText = 'Select by Month and Year'
    optionMonth.value = 'month'
    optionMonth.setAttribute('level', 1)
    selectList.appendChild(optionMonth)

    const optionQuarter = document.createElement('option')
    optionQuarter.innerText = 'Select by Quarter and Year'
    optionQuarter.value = 'quarter'
    optionQuarter.setAttribute('level', 1)
    selectList.appendChild(optionQuarter)

    const optionTheme = document.createElement('option')
    optionTheme.innerText = 'Select by Theme'
    optionTheme.value = 'theme'
    optionTheme.setAttribute('level', 1)
    selectList.appendChild(optionTheme)

    const optionBalance = document.createElement('option')
    optionBalance.innerText = 'Select by Balance'
    optionBalance.value = 'balance'
    optionBalance.setAttribute('level', 1)
    selectList.appendChild(optionBalance)

    const optionType = document.createElement('option')
    optionType.innerText = 'Select by Event Length'
    optionType.value = 'type'
    optionType.setAttribute('level', 1)
    selectList.appendChild(optionType)
  }

  const loadSubBase = (type) => {
    const headerText = ascendLabel
    const headerValue = ascendValue
    clearList()

    let subBaseData
    let sortMode // 0 = asecending, 1 = descending

    switch (type) {
      case 'year':
        subBaseData = aggregateByDate(0)
        sortMode = 1
        break
      case 'month':
        subBaseData = aggregateByDate(1)
        sortMode = 1
        break
      case 'quarter':
        subBaseData = aggregateByDate(2)
        sortMode = 1
        break
      case 'theme':
        subBaseData = aggregateByTheme()
        sortMode = 0
        break
      case 'balance':
        subBaseData = aggregateByCommonBalance()
        sortMode = 0
        break
      case 'type':
        subBaseData = aggregateByEventType()
        sortMode = 0
        break
      default:
        console.warn(`Invalid subbase name ${type}`)
    }

    const optionHeader = document.createElement('option')
    optionHeader.innerText = `— ${headerText} —`
    selectList.appendChild(optionHeader)

    if (subBaseData) {
      if (sortMode === 0) {
        // sort along title axis rather than ID
        let subBaseDataSorted = {}

        Object
        .keys(subBaseData).sort(function(a, b) {
          return subBaseData[a]["title"].localeCompare(subBaseData[b]["title"])
        })
        .forEach(function(key) {
          console.log(key)
          subBaseDataSorted[key] = subBaseData[key]
        })

        console.log(subBaseDataSorted)

        const keys = Object.keys(subBaseDataSorted)
        const values = Object.values(subBaseDataSorted)

        for (let i = 0; i < keys.length; i++) {
          const optionSub = document.createElement('option')
          optionSub.innerText = `${values[i]["title"]} (${values[i]["count"]})`
          optionSub.value = `${headerValue}_${keys[i]}`
          optionSub.setAttribute('level', 2)
          selectList.appendChild(optionSub)
        }
      } else {
        const keys = Object.keys(subBaseData)
        const values = Object.values(subBaseData)

        for (let i = keys.length - 1; i >= 0; i--) {
          const optionSub = document.createElement('option')
          optionSub.innerText = `${values[i]["title"]} (${values[i]["count"]})`
          optionSub.value = `${headerValue}_${keys[i]}`
          optionSub.setAttribute('level', 2)
          selectList.appendChild(optionSub)
        }
      }
    }

    const optionBack = document.createElement('option')
    optionBack.innerText = '← Back'
    optionBack.setAttribute('level', 0)
    selectList.appendChild(optionBack)
  }

  const loadSelect = (type) => {
    const headerText = document.querySelector('option:checked').innerText
    clearList()

    let selectData

    const parameterSplit = type.split('_')
    const subBase = parameterSplit[0]
    const arg = parameterSplit[1]

    switch (subBase) {
      case 'year':
        selectData = selectByDate(parseInt(arg))
        break
      case 'month':
        {
          const year = arg.substring(0, 4)
          const month = arg.substring(4)
          selectData = selectByDate(parseInt(year), parseInt(month))
        }
        break
      case 'quarter':
        {
          const year = arg.substring(0, 4)
          const quarter = arg.substring(4)
          selectData = selectByDate(parseInt(year), undefined, parseInt(quarter))
        }
        break
      case 'theme':
        selectData = selectByTheme(arg)
        break
      case 'balance':
        selectData = selectByCommonBalance(arg)
        break
      case 'type':
        selectData = selectByEventType(arg)
        break
      default:
        console.warn(`Invalid subbase name ${type}`)
    }

    const optionHeader = document.createElement('option')
    optionHeader.innerText = `— ${headerText} —`
    selectList.appendChild(optionHeader)

    if (selectData) {
      const keys = Object.keys(selectData)
      const values = Object.values(selectData)

      for (let i = 0; i < keys.length; i++) {
        const optionSub = document.createElement('option')
        optionSub.innerText = `${getEventDetails(values[i]["eventName"])["short"]} (${new Date(values[i]["startDate"]).toDateString().substring(4)} to ${new Date(values[i]["endDate"]).toDateString().substring(4)})`
        optionSub.value = values[i]["eventId"]
        selectList.appendChild(optionSub)
      }
    }

    const optionBack = document.createElement('option')
    optionBack.innerText = '← Back'
    optionBack.value = ascendValue
    optionBack.setAttribute('level', 1)
    selectList.appendChild(optionBack)
  }

  const aggregateByDate = (type) => {
    switch (type) {
      case 0:
        let yearContainer = {}
        for (i of data) {
          const start = new Date(i["startDate"])
          const end = new Date(i["endDate"])
          let queryString = start.getFullYear().toString()

          if (!Object.keys(yearContainer).includes(queryString)) {
            yearContainer[queryString] = {
              "title": queryString,
              "count": 1
            }
          } else {
            yearContainer[queryString]["count"]++
          }

          if (start.getFullYear() !== end.getFullYear()) {
            queryString = end.getFullYear().toString()
            if (!Object.keys(yearContainer).includes(queryString)) {
              yearContainer[queryString] = {
                "title": queryString,
                "count": 1
              }
            } else {
              yearContainer[queryString]["count"]++
            }
          }
        }

        return yearContainer
      case 1:
        let yearMonthContainer = {}
        for (i of data) {
          const start = new Date(i["startDate"])
          const end = new Date(i["endDate"])
          let queryString = `${start.getFullYear().toString()}${start.getMonth().toString().padStart(2, '0')}`

          if (!Object.keys(yearMonthContainer).includes(queryString)) {
            const date = new Date()
            date.setFullYear(queryString.slice(0, 4))
            date.setMonth(queryString.slice(4))

            yearMonthContainer[queryString] = {
              "title": date.toLocaleString('en-us', {month: 'long', year: 'numeric'}),
              "count": 1
            }
          } else {
            yearMonthContainer[queryString]["count"]++
          }

          if (end.getMonth() !== start.getMonth()) {
            queryString = `${end.getFullYear().toString()}${end.getMonth().toString().padStart(2, '0')}`
            if (!Object.keys(yearMonthContainer).includes(queryString)) {
              const date = new Date()
              date.setFullYear(queryString.slice(0, 4))
              date.setMonth(queryString.slice(4))

              yearMonthContainer[queryString] = {
                "title": date.toLocaleString('en-us', {month: 'long', year: 'numeric'}),
                "count": 1
              }
            } else {
              yearMonthContainer[queryString]["count"]++
            }
          }
        }

        return yearMonthContainer
      case 2:
        let yearQuarterContainer = {}
        for (i of data) {
          const start = new Date(i["startDate"])
          const end = new Date(i["endDate"])
          let queryString = `${start.getFullYear().toString()}${Math.floor(start.getMonth()/3).toString().padStart(2, '0')}`

          if (!Object.keys(yearQuarterContainer).includes(queryString)) {
            yearQuarterContainer[queryString] = {
              "title": `Q${parseInt(queryString.slice(4))+1} ${queryString.slice(0, 4)}`,
              "count": 1
            }
          } else {
            yearQuarterContainer[queryString]["count"]++
          }

          if (Math.floor(end.getMonth()/3) !== Math.floor(start.getMonth()/3)) {
            queryString = `${end.getFullYear().toString()}${Math.floor(end.getMonth()/3).toString().padStart(2, '0')}`
            if (!Object.keys(yearQuarterContainer).includes(queryString)) {
              yearQuarterContainer[queryString] = {
                "title": `Q${parseInt(queryString.slice(4))+1} ${queryString.slice(0, 4)}`,
                "count": 1
              }
            } else {
              yearQuarterContainer[queryString]["count"]++
            }
          }
        }

        return yearQuarterContainer
    }
  }

  const aggregateByTheme = () => {
    let themeContainer = {}
    for (i of data) {
      const eventName = i["eventName"]

      if (!Object.keys(themeContainer).includes(eventName)) {
        themeContainer[eventName] = {
          "title": eventDetails[eventName]["name"],
          "count": Object.values(data).filter(element => element["eventName"] === eventName).length
        }
      }
    }

    return themeContainer
  }

  const aggregateByCommonBalance = () => {
    let commonBalanceContainer = {}
    for (i of data) {
      const eventName = i["eventName"]
      const commonBalance = eventDetails[eventName]["commonBalance"]

      if (!Object.keys(commonBalanceContainer).includes(commonBalance)) {
        const matchingIds = Object.keys(eventDetails).filter(key => eventDetails[key]["commonBalance"] === commonBalance)
        commonBalanceContainer[commonBalance] = {
          "title": getEventCommonBalanceName(eventDetails[eventName]["commonBalance"]),
          "count": Object.values(data).filter(element => matchingIds.includes(element["eventName"])).length
        }
      }
    }

    return commonBalanceContainer
  }

  const aggregateByEventType = () => {
    let eventTypeContainer = {}
    for (i of data) {
      const eventName = i["eventName"]
      const eventType = eventDetails[eventName]["eventType"]

      if (!Object.keys(eventTypeContainer).includes(eventType)) {
        const matchingIds = Object.keys(eventDetails).filter(key => eventDetails[key]["eventType"] === eventType)
        eventTypeContainer[eventType] = {
          "title": getEventTypeName(eventDetails[eventName]["eventType"]),
          "count": Object.values(data).filter(element => matchingIds.includes(element["eventName"])).length
        }
      }
    }

    return eventTypeContainer
  }

  const selectByDate = (year, month, quarter) => {
    if (!year) {
      return
    }

    console.log(year, month, quarter)

    let events = []
    for (let i of data) {
      const start = new Date(i["startDate"])
      const end = new Date(i["endDate"])

      // DO NOT include "Z", as the search is according to local, not UTC time
      let queryStart = new Date("1970-01-01T00:00:00")
      let queryEnd = new Date("2099-12-31T23:59:59")

      queryStart.setFullYear(year)
      queryEnd.setFullYear(year)

      if (end >= queryStart && start <= queryEnd) {
        if (isNaN(month) && isNaN(quarter)) {
          // year only
          events.push(i)
        } else if (!isNaN(month)) {
          // month takes precedence over quarter
          queryStart.setMonth(month)
          queryEnd.setMonth(month)

          // hacky way to get around month/quarter overflow
          while (queryEnd.getMonth() !== queryStart.getMonth()) {
            queryEnd.setDate(queryEnd.getDate() - 1)
          }

          if (end >= queryStart && start <= queryEnd) {
            events.push(i)
          }
        } else {
          // quarter comes last
          queryStart.setMonth(quarter * 3)
          queryEnd.setMonth(quarter * 3 + 2)

          // hacky way to get around month/quarter overflow
          while (queryEnd.getMonth() !== (queryStart.getMonth() + 2)) {
            queryEnd.setDate(queryEnd.getDate() - 1)
          }

          if (end >= queryStart && start <= queryEnd) {
            events.push(i)
          }
        }
      }
    }

    return events
  }

  const selectByTheme = (themeId) => {
    return Object.values(data).filter(element => element["eventName"] === themeId)
  }

  const selectByCommonBalance = (commonId) => {
    const matchingIds = Object.keys(eventDetails).filter(key => eventDetails[key]["commonBalance"] === commonId)
    return Object.values(data).filter(element => matchingIds.includes(element["eventName"]))
  }

  const selectByEventType = (eventType) => {
    const matchingIds = Object.keys(eventDetails).filter(key => eventDetails[key]["eventType"] === eventType)
    return Object.values(data).filter(element => matchingIds.includes(element["eventName"]))
  }

  const onChangeEventListener = () => {
    const selectedOption = selectList.options[selectList.selectedIndex]
    
    if (selectedOption.getAttribute('level') !== null && level !== parseInt(selectedOption.getAttribute('level'))) {
      if (level === 0) {
        ascendLabel = selectedOption.innerText
        ascendValue = selectedOption.value
      }

      level = parseInt(selectedOption.getAttribute('level'))
      loadByLevel(selectedOption.value)
    }
  }

  let ascendLabel = ''
  let ascendValue = ''

  let level = -1
  const eventDetails = getAllEventDetails()

  selectList.removeAttribute('disabled')
  selectButton.removeAttribute('disabled')

  selectList.addEventListener('change', onChangeEventListener)

  if (data.length === 0) {
    const optionNone = document.createElement('option')
    optionNone.innerText = 'No events available'
    selectList.appendChild(optionNone)
    return
  }

  // if level is a non-negative integer, it is in a loaded and operable state.
  level = 0
  loadByLevel()

  // return event listener so it can be removed later
  return onChangeEventListener
}