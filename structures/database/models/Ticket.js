const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionName: String,
  question: String,
  answer: String
});

const ListOfQuestionsSchema = new mongoose.Schema({
  list: [{
    name: String,
    question: String
  }],
  ticketCategory: Object,
  modalArr: Array
});

const TicketDataSchema = new mongoose.Schema({
  owner: String,
  openedAt: Date,
  openedTimestamp: String,
  id: Number,
  category: String,
});

const TicketSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  ticketData: {
    type: TicketDataSchema,
    default: {}
  },
  ticketClaimed: {
    type: String,
    default: ""
  },
  autoClaim: {
    type: String,
    default: ""
  },
  notes: {
    type: String,
    default: ""
  },
  listOfQuestions: {
    type: ListOfQuestionsSchema,
    default: {}
  },
  listOfAnswers: {
    type: [QuestionSchema],
    default: []
  },
  questionPage: {
    type: Number,
    default: 1
  },
  questionsAnswered: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    default: ""
  } 
});

module.exports = mongoose.model("Ticket", TicketSchema);