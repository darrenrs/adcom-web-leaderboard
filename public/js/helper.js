const getPlayerNameFromOrdinal = (n) => {
  if (n < 0) {
    return {"defaultName": 'Not available if archived'}
  }

  const nameValues = {
    "Adjectives": [
      "Supreme",
      "Super",
      "Glorious",
      "Marvelous",
      "Brilliant",
      "Great",
      "Prosperous",
      "Red",
      "Pink",
      "Crimson",
      "Scarlet",
      "Patriotic",
      "True",
      "Model",
      "Communistic",
      "Iron"
    ],
    "Nouns": [
      "Chicken",
      "Captain",
      "Communist",
      "Comrade",
      "Leader",
      "Guardian",
      "Guard",
      "Worker",
      "Pioneer",
      "Soldier",
      "Proletariat",
      "Revolutionist",
      "Socialist"
    ],
    "Generations": [
      "I",
      "V",
      "X",
      "L",
      "C",
      "D",
      "M"
    ],
    "IconColors": [
      "green",
      "blue",
      "pink",
      "red",
      "orange",
      "yellow"
    ],
    "IconTextures": [
      "bomb",
      "boots",
      "cactus",
      "dinosaur",
      "drumstick",
      "fish",
      "skull",
      "sword"
    ]
  }
  
  const baseCaseIndex = [0, 7, 4, 0, 0]
  const incrementValue = [1, 2, 3, 1, 1]
  
  const adjective = nameValues["Adjectives"][((n * incrementValue[0]) + baseCaseIndex[0]) % nameValues["Adjectives"].length]
  const noun = nameValues["Nouns"][((n * incrementValue[1]) + baseCaseIndex[1]) % nameValues["Nouns"].length]
  const generation = nameValues["Generations"][((n * incrementValue[2]) + baseCaseIndex[2]) % nameValues["Generations"].length]
  
  const iconColor = nameValues["IconColors"][((n * incrementValue[3]) + baseCaseIndex[3]) % nameValues["IconColors"].length]
  const iconTexture = nameValues["IconTextures"][((n * incrementValue[4]) + baseCaseIndex[4]) % nameValues["IconTextures"].length]
  
  const fullName = `${adjective} ${noun} ${generation}`
  const url = `img/icons/${iconTexture}.png`

  const returnStruct = {
    "defaultName": fullName,
    "imagePath": url,
    "texture": iconTexture,
    "color": iconColor
  }

  return returnStruct
}

const getAllEventDetails = () => {
  return {
    "atlantis": {
      "name": "Anew Atlantis",
      "short": "Atlantis",
      "desc": "Fish are Comrades too. Dive deep to restore the kingdom of Atlantis with the glory of Communism leading the way.",
      "commonBalance": "atlantis",
      "eventType": "weekend"
    },
    "attack": {
      "name": "Quest for Oil",
      "short": "Oil",
      "desc": "Glorious State needs more oil to expand the glory of Communism",
      "commonBalance": "globalmini",
      "eventType": "mini"
    },
    "bamboo": {
      "name": "Comrade's Communist Vacation!",
      "short": "Vacation",
      "desc": "When it's time to get away, the best (and only) place for Comrades is the Great Motherland Resort and Supreme State Spa!",
      "commonBalance": "legacysanta",
      "eventType": "supreme"
    },
    "cockatrice": {
      "name": "Comrades & Cockatrices",
      "short": "C&C",
      "desc": "It's game night, Comrade! Grab some snacks, your dice set and character sheet, because it's time for an adventure party!",
      "commonBalance": "legacysanta",
      "eventType": "supreme"
    },
    "cowboy": {
      "name": "Comrade Cowboys",
      "short": "Cowboy",
      "desc": "Reshape the wild west with the glories of Communism. Expand the railways and become the sheriff of a new socialist frontier.",
      "commonBalance": "space",
      "eventType": "weekend"
    },
    "crusade": {
      "name": "Communist Crusade",
      "short": "Crusade",
      "desc": "The dark ages need light! Bring the glory of Communism to a fantastic land of wizards, knights, and dragons!",
      "commonBalance": "crusade",
      "eventType": "weekend"
    },
    "defense": {
      "name": "Shields Up",
      "short": "Shield",
      "desc": "We are under attack! Activate defense protocols and protect the comrades.",
      "commonBalance": "industrymini",
      "eventType": "mini"
    },
    "export": {
      "name": "Potato Export",
      "short": "Export",
      "desc": "Communist allies are hungry, and Glorious State is here to help.",
      "commonBalance": "industrymini",
      "eventType": "mini"
    },
    "fusfarm": {
      "name": "Farm to Table",
      "short": "Farm to Table",
      "desc": "From the soil to our plates, potatoes make the greatest of journeys to fuel our great State!",
      "commonBalance": "fusionages",
      "eventType": "fusion"
    },
    "fuspet": {
      "name": "Grand Pet Show",
      "short": "Pet Show",
      "desc": "It's a party of animals! Which one of these fine pets will be crowned best in show?",
      "commonBalance": "fusionnew",
      "eventType": "fusion"
    },
    "fusscience": {
      "name": "State Science",
      "short": "State Science",
      "desc": "Eureka! Communism progresses in leaps and bounds with the power of science!",
      "commonBalance": "fusionages",
      "eventType": "fusion"
    },
    "fusvehicle": {
      "name": "Supreme Vehicle Show",
      "short": "Vehicle Show",
      "desc": "Vroom! Get your hands behind the wheel of some of the most impressive vehicles in the Motherland!",
      "commonBalance": "fusionnew",
      "eventType": "fusion"
    },
    "hexathlon": {
      "name": "The Motherland Games",
      "short": "Motherland Games",
      "desc": "Cheer on our Comrades as the world's best athletes compete in the Motherland's greatest farming competition! Let's go, Comrades!",
      "commonBalance": "newsanta",
      "eventType": "supreme"
    },
    "ninja": {
      "name": "Ninja Union",
      "short": "Ninja",
      "desc": "Seek to master the deadly arts of Communism in an ancient land of honor and discipline. Find enlightenment and become a supreme Ninja Master.",
      "commonBalance": "crusade",
      "eventType": "weekend"
    },
    "potatofactory": {
      "name": "Glorious Potato Factory",
      "short": "Potato Factory",
      "desc": "Grow your Communist food empire from humble beginnings and become the pride of the glorious Motherland!",
      "commonBalance": "newsanta",
      "eventType": "supreme"
    },
    "power": {
      "name": "Power Underwhelming",
      "short": "Power",
      "desc": "Power outage! Glorious State needs an electricity surge.",
      "commonBalance": "globalmini",
      "eventType": "mini"
    },
    "santa": {
      "name": "Supreme Santa",
      "short": "Santa",
      "desc": "Conquer the North Pole in the name of the Motherland! Build a new Great State in a frozen landscape and celebrate the gift of Communism with all your comrades!",
      "commonBalance": "legacysanta",
      "eventType": "supreme"
    },
    "space": {
      "name": "Space Force",
      "short": "Space",
      "desc": "Take control of the Communist space program tasked with spreading the glory of communism into the cosmos!",
      "commonBalance": "space",
      "eventType": "weekend"
    },
    "spooky": {
      "name": "Spooky State",
      "short": "Spooky",
      "desc": "Collect candy and conjure Comrades to seize the means of trick or treating season!",
      "commonBalance": "legacysanta",
      "eventType": "supreme"
    },
    "stone": {
      "name": "Stone State",
      "short": "Stone",
      "desc": "Show our Comrade ancestors the glory of Communism and lead them out of the Stone Age!",
      "commonBalance": "atlantis",
      "eventType": "weekend"
    },
    "supervillain": {
      "name": "Supreme Supervillain",
      "short": "Supervillain",
      "desc": "Build your villainous base and prepare your monolog! It's time to show our Capitalist nemesis the greatness of Communism!",
      "commonBalance": "newsanta",
      "eventType": "supreme"
    },
    "winter": {
      "name": "Winter Motherland",
      "short": "Winter",
      "desc": "Winter in the Motherland is a time to celebrate the glories of Communism by raising a mug of socialist-cider in the name of Supreme Leader!",
      "commonBalance": "atlantis",
      "eventType": "weekend"
    },
    "zombie": {
      "name": "Zombie Revolution",
      "short": "Zombie",
      "desc": "Show our Comrade survivors how to handle the zombie Capitalist outbreak and rebuild the Motherland!",
      "commonBalance": "crusade",
      "eventType": "weekend"
    }
  }
}

const getEventDetails = (eventId) => {
  const eventMetadata = getAllEventDetails()

  return eventMetadata[eventId]
}

const getEventCommonBalanceName = (commonBalanceId) => {
  switch (commonBalanceId) {
    case 'atlantis':
      return 'Atlantis/Winter/Stone'
    case 'crusade':
      return 'Crusade/Ninja/Zombie'
    case 'space':
      return 'Space/Cowboy'
    case 'globalmini':
      return 'Oil/Power Mini'
    case 'industrymini':
      return 'Export/Shield Mini'
    case 'legacysanta':
      return 'Original Santa Balances'
    case 'newsanta':
      return 'New Santa Balances'
    case 'fusionages':
      return 'Ages Fusions'
    case 'fusionnew':
      return 'New Fusions'
    default:
      return 'Unknown common event balance'
  }
}

const getEventTypeName = (eventType) => {
  switch (eventType) {
    case 'weekend':
      return 'Weekend Event (4 days 4 hours)'
    case 'mini':
      return 'Mini Event (1 day 4 hours)'
    case 'supreme':
      return 'Supreme Event (11 days 4 hours)'
    case 'fusion':
      return 'Fusion Event (2 days 4 hours)'
    default:
      return 'Unknown event type'
  }
}

const getSpendingCategory = (b) => {
  if (!b) {
    return 'No division'
  }

  if (b.includes("default")) {
    return 'Spending-agnostic bracket'
  }

  const re = /[A-Z_\d]+/g
  
  switch (re.exec(b)[0]) {
    case 'SPEND_GT_500':
      return '>$500 lifetime spent'
    case 'SPEND_100_TO_500':
      return '$100–$499 lifetime spent'
    case 'SPEND_2_TO_100':
      return '$2–$99 lifetime spent'
    case 'SPEND_LTE_2':
      return '<$2 lifetime spent'
    case 'RANK_19_TO_29':
      return 'Motherland rank 19–29'
    case 'RANK_UPTO_18':
      return 'Motherland rank 1–18'
    default:
      return 'Unknown bracket type'
  }
}


const amountSpentDollars = (b) => {
  if (!b) {
    return ''
  }

  const re = /[A-Z_\d]+/g
  
  switch (re.exec(b)[0]) {
    case 'SPEND_GT_500':
      return '$$$'
    case 'SPEND_100_TO_500':
      return '$$'
    case 'SPEND_2_TO_100':
      return '$'
    default:
      return ''
  }
}

const getDivisionSuffix = (b) => {
  if (!b) {
    return ''
  }

  const re = /:(\d*)/g
  return re.exec(b)[0].slice(1)
}

const getLeaderboardType = (t) => {
  switch (t) {
    case 'global':
      return 'Normal'
    case 'sandbox':
      return 'Cheater'
    case 'dev':
    case 'qa':
      return 'Developer'
    default:
      return 'Unknown'
  }
}

const getTimedeltaFormat = (timestamp) => {
  let current = new Date()
  let timeSeconds = Math.abs((timestamp - current) / 1000)

  let years = Math.floor(timeSeconds / (60 * 60 * 24 * 365))
  let days = Math.floor(timeSeconds / (60 * 60 * 24)) % 365
  let hours = Math.floor(timeSeconds / (60 * 60)) % 24
  let minutes = Math.floor(timeSeconds / 60) % 60
  
  if (timeSeconds < 3600) {
    return `${minutes}<span class="time-suffix">m</span>`
  } else if (timeSeconds < 24 * 3600) {
    return `${hours}<span class="time-suffix">h</span> ${minutes}<span class="time-suffix">m</span>`
  } else if (timeSeconds < 24 * 3600 * 365) {
    return `${days}<span class="time-suffix">d</span> ${hours}<span class="time-suffix">h</span>`
  } else {
    return `${years}<span class="time-suffix">y</span> ${days}<span class="time-suffix">d</span> ${hours}<span class="time-suffix">h</span>`
  }
}

const getFastTimedeltaFormat = (sec) => {
  if (sec < 10) {
    return `${(sec).toFixed(3)}<span class="time-suffix">s</span>`
  } else if (sec < 60) {
    return `${(sec).toFixed(2)}<span class="time-suffix">s</span>`
  } else if (sec < 3600) {
    return `${Math.floor(sec / 60)}<span class="time-suffix">m</span> ${Math.floor(sec % 60)}<span class="time-suffix">s</span>`
  } else if (sec < 86400) {
    return `${Math.floor(sec / 3600)}<span class="time-suffix">h</span> ${Math.floor((sec / 60) % 60)}<span class="time-suffix">m</span> ${Math.floor(sec % 60)}<span class="time-suffix">s</span>`
  } else {
    return `${Math.floor(sec / 86400)}<span class="time-suffix">d</span> ${Math.floor((sec / 3600) % 24)}<span class="time-suffix">h</span> ${Math.floor((sec / 60) % 60)}<span class="time-suffix">m</span>`
  }
}

const getPositionHTMLFormat = (n) => {
  const numString = n.toString()
  const lastDigit = numString.charAt(numString.length - 1)
  let ordinal = ""

  if (numString.length >= 2 && numString.charAt(numString.length - 2) === "1") {
    ordinal = "th"
  } else {
    switch (lastDigit) {
      case "1":
        ordinal = "st"
        break
      case "2":
        ordinal = "nd"
        break
      case "3":
        ordinal = "rd"
        break
      default:
        ordinal = "th"
        break
    }
  }

  const formattedNum = n.toLocaleString()

  return `${formattedNum}<sup>${ordinal}</sup>`
}

const getUsdValueFmt = (v) => {
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}