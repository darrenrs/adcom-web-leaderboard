module.exports = class SQLiteInterface {
  constructor() {
    // create database and tables if it doesn't exist
    const sqlite3 = require('sqlite3').verbose()
    this.db = new sqlite3.Database(__dirname + '/players.db')

    this.db.serialize(() => {
      this.db.run('CREATE TABLE IF NOT EXISTS "players" ("id" NOT NULL UNIQUE, "addDate" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"))')
      this.db.run('CREATE TABLE IF NOT EXISTS "players-events" ("id" NOT NULL, "eventId" NOT NULL, "exists" INTEGER NOT NULL, "addDate" INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id", "eventId"))')
    })
    
  }

  addPlayer(id) {
    // cache a player in local db so we don't need to check for their existence against the external API
    this.db.run('INSERT INTO "players" (id) VALUES (?)', [id], (err) => {
      if (err) {
        console.error(`${(new Date()).toISOString()} [internal       ] - Unable to add player to database: ${err.message}.`)
      }
    })
  }

  addPlayerEvent(id, eventId, exists) {
    // cache a player's event record in local db so we don't need to check for its existence against the external API
    this.db.run('INSERT INTO "players-events" (id, eventId, "exists") VALUES (?, ?, ?)', [id, eventId, exists], (err) => {
      if (err) {
        console.error(`${(new Date()).toISOString()} [internal       ] - Unable to add player event to database: ${err.message}.`)
      }
    })
  }

  async getPlayer(id) {
    return new Promise((resolve, reject) => {
      // return boolean indicating if player exists
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
      // return boolean indicating if player exists
      this.db.all('SELECT * FROM "players-events" WHERE id=?', [id], (err, rows) => {
        if (err) {
          reject(err)
        }

        resolve(rows)
      })      
    })
  }

  close() {
    // close database--DO NOT use a class instance after calling this method
    this.db.close()
  }
}