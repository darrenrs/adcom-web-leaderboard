function getPlayerNameFromOrdinal(n) {
  if (n < 0) {
    return 'Not available if archived'
  }

  const odict = {"Adjectives":["Supreme","Super","Glorious","Marvelous","Brilliant","Great","Prosperous","Red","Pink","Crimson","Scarlet","Patriotic","True","Model","Communistic","Iron"],"Nouns":["Chicken","Captain","Communist","Comrade","Leader","Guardian","Guard","Worker","Pioneer","Soldier","Proletariat","Revolutionist","Socialist"],"Generations":["I","V","X","L","C","D","M"],"IconColors":["Green", "Blue", "Pink", "Red", "Orange", "Yellow"],"IconTextures":["Bomb", "Boot", "Cactus", "Dino", "Chicken", "Fish", "Skull", "Sword"]}
  const baseCaseIndex = [0, 7, 4, 0, 0]
  const incrementValue = [1, 2, 3, 1, 1]
  
  let n0 = odict["Adjectives"][((n * incrementValue[0]) + baseCaseIndex[0]) % odict["Adjectives"].length]
  let n1 = odict["Nouns"][((n * incrementValue[1]) + baseCaseIndex[1]) % odict["Nouns"].length]
  let n2 = odict["Generations"][((n * incrementValue[2]) + baseCaseIndex[2]) % odict["Generations"].length]
  
  fullName = `${n0} ${n1} ${n2}`

  return fullName
}

function getEventDetails(eventId) {
  const odict = {"atlantis":{"name":"Anew Atlantis","short":"Atlantis","desc":"Fish are Comrades too. Dive deep to restore the kingdom of Atlantis with the glory of Communism leading the way."},"attack":{"name":"Quest for Oil","short":"Oil","desc":"Glorious State needs more oil to expand the glory of Communism"},"bamboo":{"name":"Comrade's Communist Vacation!","short":"Vacation","desc":"When it's time to get away, the best (and only) place for Comrades is the Great Motherland Resort and Supreme State Spa!"},"cockatrice":{"name":"Comrades & Cockatrices","short":"C&C","desc":"It's game night, Comrade! Grab some snacks, your dice set and character sheet, because it's time for an adventure party!"},"cowboy":{"name":"Comrade Cowboys","short":"Cowboy","desc":"Reshape the wild west with the glories of Communism. Expand the railways and become the sheriff of a new socialist frontier."},"crusade":{"name":"Communist Crusade","short":"Crusade","desc":"The dark ages need light! Bring the glory of Communism to a fantastic land of wizards, knights, and dragons!"},"defense":{"name":"Shields Up","short":"Shield","desc":"We are under attack! Activate defense protocols and protect the comrades."},"export":{"name":"Potato Export","short":"Export","desc":"Communist allies are hungry, and Glorious State is here to help."},"fusfarm":{"name":"Farm to Table","short":"Farm to Table","desc":"From the soil to our plates, potatoes make the greatest of journeys to fuel our great State!"},"fuspet":{"name":"Grand Pet Show","short":"Pet Show","desc":"It's a party of animals! Which one of these fine pets will be crowned best in show?"},"fusscience":{"name":"State Science","short":"State Science","desc":"Eureka! Communism progresses in leaps and bounds with the power of science!"},"fusvehicle":{"name":"Supreme Vehicle Show","short":"Vehicle Show","desc":"Vroom! Get your hands behind the wheel of some of the most impressive vehicles in the Motherland!"},"hexathlon":{"name":"The Motherland Games","short":"Motherland Games","desc":"Cheer on our Comrades as the world's best athletes compete in the Motherland's greatest farming competition! Let's go, Comrades!"},"ninja":{"name":"Ninja Union","short":"Ninja","desc":"Seek to master the deadly arts of Communism in an ancient land of honor and discipline. Find enlightenment and become a supreme Ninja Master."},"potatofactory":{"name":"Glorious Potato Factory","short":"Potato Factory","desc":"Grow your Communist food empire from humble beginnings and become the pride of the glorious Motherland!"},"power":{"name":"Power Underwhelming","short":"Power","desc":"Power outage! Glorious State needs an electricity surge."},"santa":{"name":"Supreme Santa","short":"Santa","desc":"Conquer the North Pole in the name of the Motherland! Build a new Great State in a frozen landscape and celebrate the gift of Communism with all your comrades!"},"space":{"name":"Space Force","short":"Space","desc":"Take control of the Communist space program tasked with spreading the glory of communism into the cosmos!"},"spooky":{"name":"Spooky State","short":"Spooky","desc":"Collect candy and conjure Comrades to seize the means of trick or treating season!"},"stone":{"name":"Stone State","short":"Stone","desc":"Show our Comrade ancestors the glory of Communism and lead them out of the Stone Age!"},"supervillain":{"name":"Supreme Supervillain","short":"Supervillain","desc":"Build your villainous base and prepare your monolog! It's time to show our Capitalist nemesis the greatness of Communism!"},"winter":{"name":"Winter Motherland","short":"Winter","desc":"Winter in the Motherland is a time to celebrate the glories of Communism by raising a mug of socialist-cider in the name of Supreme Leader!"},"zombie":{"name":"Zombie Revolution","short":"Zombie","desc":"Show our Comrade survivors how to handle the zombie Capitalist outbreak and rebuild the Motherland!"}}
  return odict[eventId]
}

function getSpendingCategory(b) {
  if (!b) {
    console.warn("The requested player has no division. If this is you, please let Enigma#2989 know on Discord.")
    return 'No division (ultra rare bug)'
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

function getLeaderboardType(t) {
  switch (t) {
    case 'global':
      return 'Normal'
    case 'sandbox':
      return 'Cheater'
    case 'dev':
    case 'qa':
      return 'Dev'
    default:
      return 'Unknown'
  }
}

function getTimedeltaFormat(timestamp) {
  let current = new Date()
  let timeSeconds = Math.abs((timestamp - current) / 1000)

  let days = Math.floor(timeSeconds / (60 * 60 * 24)) % 365
  let hours = Math.floor(timeSeconds / (60 * 60)) % 24
  let minutes = Math.floor(timeSeconds / 60) % 60
  
  if (timeSeconds < 3600) {
    return `${minutes}m`
  } else if (timeSeconds < 24 * 3600) {
    return `${hours}h ${minutes}m`
  } else {
    return `${days}d ${hours}h`
  }
}

function getOrdinalFormat(n) {
  n = Math.abs(n)
  ns = n.toLocaleString()
  if (n % 100 >= 11 && n % 100 <= 13) {
    return `${ns}th`
  } else if (n % 10 === 1) {
    return `${ns}st`
  } else if (n % 10 === 2) {
    return `${ns}nd`
  } else if (n % 10 === 3) {
    return `${ns}rd`
  } else {
    return `${ns}th`
  }
}