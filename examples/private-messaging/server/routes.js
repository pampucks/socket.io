const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('./models/UserData');

// const validateSchema = new mongoose.Schema({
//   kodeTV: { type: String, required: true, unique: true },
// });

// const Item = mongoose.model('Validate', validateSchema);

//API Endpoints
router.post('/validate', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const item = await User.findOne({ username });
    if (item) {
      // proceed to run a function in index.js

      return res
        .status(200)
        .json({ success: true, message: 'username found in database' });
    } else {
      return res
        .status(404)
        .json({ success: false, message: 'username not found in database' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
