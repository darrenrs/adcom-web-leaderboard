module.exports = class SQLiteInterface {
  // create database and tables if it doesn't exist
  constructor() {
    const sqlite3 = require('sqlite3').verbose()
    this.db = new sqlite3.Database(__dirname + '/players.db')

    this.db.serialize(() => {
      this.db.run('CREATE TABLE IF NOT EXISTS "players" ("id" NOT NULL UNIQUE, "addDate" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"))')
      this.db.run('CREATE TABLE IF NOT EXISTS "players-events" ("id" NOT NULL, "eventId" NOT NULL, "exists" INTEGER NOT NULL, "addDate" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id", "eventId"))')
      this.db.run('CREATE TABLE IF NOT EXISTS "players-discord" ("id" NOT NULL UNIQUE, "discordId", "displayName" NOT NULL, "username" NOT NULL, "lastCheckDate" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, "iconQualitativeDesc" TEXT, PRIMARY KEY ("id"))')
    })
  }

  // cache a player in local db so we don't need to check for their existence against the external API
  addPlayer(id) {
    this.db.run('INSERT INTO "players" (id) VALUES (?)', [id], (err) => {
      if (err) {
        console.error(`${(new Date()).toISOString()} [internal] - Unable to add player to database: ${err.message}.`)
      }
    })
  }

  // cache a player's event record in local db so we don't need to check for its existence against the external API
  addPlayerEvent(id, eventId, exists) {
    this.db.run('INSERT INTO "players-events" (id, eventId, "exists") VALUES (?, ?, ?)', [id, eventId, exists], (err) => {
      if (err) {
        console.error(`${(new Date()).toISOString()} [internal] - Unable to add player event to database: ${err.message}.`)
      }
    })
  }

  // add player record to Discord leaderboard
  addPlayerDiscord = async (id, discordId, displayName, username, iconQualitativeDesc) => {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO "players-discord" (id, discordId, displayName, username, iconQualitativeDesc) VALUES (?, ?, ?, ?, ?)', 
        [id, discordId, displayName, username, iconQualitativeDesc],
        (err) => {
          if (err) {
            console.error(`${(new Date()).toISOString()} [internal] - Unable to add Discord record to database: ${err.message}.`)
            reject(err.message)
          } else {
            resolve(true)
          }
        }
      )
    })
  }

  // update player record in Discord leaderboard
  updatePlayerDiscord = async (id, discordId, displayName, username, iconQualitativeDesc) => {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE "players-discord" SET discordId=?, displayName=?, username=?, iconQualitativeDesc=?, lastCheckDate=CURRENT_TIMESTAMP WHERE id=?', 
        [discordId, displayName, username, iconQualitativeDesc, id],
        async function (err) {
          if (err) {
            console.error(`${(new Date()).toISOString()} [internal] - Unable to update Discord record in database: ${err.message}.`)
            reject(err.message)
          } else {
            if (this.changes < 1) {
              console.error(`${(new Date()).toISOString()} [internal] - Unable to remove player Discord record from database: no records found.`)
              reject('no records found')
            } else {
              resolve(true)
            }
          }
        }
      )
    })
  }

  // remove player record from Discord leaderboard
  removePlayerDiscord = async (id) => {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM "players-discord" WHERE id=?',
        [id], 
        async function (err) {
          if (err) {
            console.error(`${(new Date()).toISOString()} [internal] - Unable to remove player Discord record from database: ${err.message}.`)
            reject(err.message)
          } else {
            if (this.changes < 1) {
              console.error(`${(new Date()).toISOString()} [internal] - Unable to remove player Discord record from database: no records found.`)
              reject('no records found')
            } else {
              resolve(true)
            }
          }
        }
      )
    })
  }

  updatePlayerDiscordTimestamp = async (id) => {return new Promise((resolve, reject) => {
    this.db.run(
      'UPDATE "players-discord" SET lastCheckDate=CURRENT_TIMESTAMP WHERE id=?',
      [id],
      (err) => {
        if (err) {
          console.error(`${(new Date()).toISOString()} [internal] - Unable to add Discord record to database: ${err.message}.`)
          reject(err.message)
        } else {
          resolve(true)
        }
      }
    )
  })
  }

  async getPlayer(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM "players" WHERE id=?', [id], (err, row) => {
        if (err) {
          reject(err)
        }

        resolve(Boolean(row))
      })
    })
  }

  async getPlayerEvents(id) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM "players-events" WHERE id=?', [id], (err, rows) => {
        if (err) {
          reject(err)
        }

        resolve(rows)
      })
    })
  }

  async getAllPlayers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM "players"', (err, rows) => {
        if (err) {
          reject(err)
        }

        resolve(rows)
      })
    })
  }

  async getAllPlayerEvents() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM "players-events"', (err, rows) => {
        if (err) {
          reject(err)
        }

        resolve(rows)
      })
    })
  }

  async checkPlayerDiscord(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM "players-discord" WHERE id=?', [id], (err, row) => {
        if (err) {
          reject(err)
        }
        
        resolve(row)
      })
    })
  }

  async getAllPlayerDiscordRecords() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM "players-discord" WHERE julianday(\'now\') - julianday(lastCheckDate) <= 56', (err, rows) => {
        if (err) {
          reject(err)
        }
        
        resolve(rows)
      })
    })
  }

  // close database--DO NOT use a class instance after calling this method
  close() {
    this.db.close()
  }
}