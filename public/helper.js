function getPlayerNameFromOrdinal(n) {
  const odict = {"Adjectives":["Supreme","Super","Glorious","Marvelous","Brilliant","Great","Prosperous","Red","Pink","Crimson","Scarlet","Patriotic","True","Model","Communistic","Iron"],"Nouns":["Chicken","Captain","Communist","Comrade","Leader","Guardian","Guard","Worker","Pioneer","Soldier","Proletariat","Revolutionist","Socialist"],"Generations":["I","V","X","L","C","D","M"],"IconColors":["Green", "Blue", "Pink", "Red", "Orange", "Yellow"],"IconTextures":["Bomb", "Boot", "Cactus", "Dino", "Chicken", "Fish", "Skull", "Sword"]}
  const baseCaseIndex = [0, 7, 4, 0, 0]
  const incrementValue = [1, 2, 3, 1, 1]
  
  let n0 = odict["Adjectives"][((n * incrementValue[0]) + baseCaseIndex[0]) % odict["Adjectives"].length]
  let n1 = odict["Nouns"][((n * incrementValue[1]) + baseCaseIndex[1]) % odict["Nouns"].length]
  let n2 = odict["Generations"][((n * incrementValue[2]) + baseCaseIndex[2]) % odict["Generations"].length]
  let ic = odict["IconColors"][((n * incrementValue[3]) + baseCaseIndex[3]) % odict["IconColors"].length]
  let ip = odict["IconTextures"][((n * incrementValue[4]) + baseCaseIndex[4]) % odict["IconTextures"].length]
  
  fullName = `${n0} ${n1} ${n2}`

  return fullName
}

function getSpendingCategory(b) {
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