const mongoose = require("mongoose");

const CountersSchema = new mongoose.Schema({
  openedChannel: {
    type: String,
    default: ""
  },
  totalChannel: {
    type: String,
    default: ""
  },
  claimedChannel: {
    type: String,
    default: ""
  }
});

const GuildSchema = new mongoose.Schema({
  id: {
    type: String,
  },
  suggestionDecisions: {
    type: [{
      id: String,
      decision: String
    }],
    default: []
  },
  ticketCount: {
    type: Number,
    default: 0
  },
  claimedTickets: {
    type: Number,
    default: 0
  },
  counters: CountersSchema,
  todayStats: {
    type: Array,
    default: []
  },
  weekStats: {
    type: Array,
    default: []
  },
  serverLogs: {
    type: Array,
    default: []
  },
  dashboardLogs: {
    type: Array,
    default: []
  }
});

module.exports = mongoose.model("Guild", GuildSchema);