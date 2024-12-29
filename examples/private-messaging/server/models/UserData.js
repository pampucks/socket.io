const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  userID: { type: String, required: false },
  lastResponse: { type: String, required: false },
});

const UserData = mongoose.model('UserData', userDataSchema);

module.exports = UserData;
