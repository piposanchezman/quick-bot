const { QuickDB, MySQLDriver, MongoDriver } = require("quick.db");
const chalk = require("chalk");
const MongoDatabase = require("./MongoDatabase");

module.exports = class Database {
  database;
  tables = {
    users: null,
    tickets: null,
    transcripts: null,
    guild: null
  };
  constructor(client, type = "sqlite") {
    this.client = client;
    this.type = type;

    this.initDatabase();
  }

  async initDatabase() {
    if(this.type == "sqlite" || this.type == "mysql") {
      if(this.type == "sqlite") {
        this.database = new QuickDB();
        console.log(chalk.green("[DATABASE] ") + "Starting with 'SQLite' database type.");
      } else if(this.type == "mysql") {
        console.log(chalk.green("[DATABASE] ") + "Starting with 'MySQL' database type.");
        const mysqlDriver = new MySQLDriver({
          host: this.client.config.general.database.mysql.host,
          port: this.client.config.general.database.mysql.port,
          user: this.client.config.general.database.mysql.user,
          password: this.client.config.general.database.mysql.password,
          database: this.client.config.general.database.mysql.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 60000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0
        });
  
        await mysqlDriver.connect().then(() => {
          console.log(chalk.green("[DATABASE] ") + "Connection to MySQL established.");
        });
  
        this.database = new QuickDB({ driver: mysqlDriver });
      }

      this.tables.users = this.database.table("users");
      this.tables.tickets = this.database.table("tickets");
      this.tables.transcripts = this.database.table("transcripts");
      this.tables.guild = this.database.table("guild");
    } else if(this.type == "mongo") {
      console.log(chalk.green("[DATABASE] ") + "Starting with 'MongoDB' database type.");
      
      this.database = new MongoDatabase(this.client);

      this.tables.users = this.database.usersData();
      this.tables.tickets = this.database.ticketsData();
      this.tables.transcripts = this.database.transcriptsData();
      this.tables.guild = this.database.guildData();
    }
  }

  usersData() {
    return this.tables.users;
  }

  ticketsData() {
    return this.tables.tickets;
  }

  transcriptsData() {
    return this.tables.transcripts;
  }

  guildData() {
    return this.tables.guild;
  }
}
