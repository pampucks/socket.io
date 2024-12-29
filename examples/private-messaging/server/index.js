const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./db');
const User = require('./models/UserData');

const app = express();

const corsOptions = {
  origin: 'http://192.168.1.104:4000', // Allow requests from your frontend port
  methods: ['GET', 'POST'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type'], // Allowed headers
  credentials: true, // Allow cookies (if needed)
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
const httpServer = require('http').createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    // Handle 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page Not Found');
  }
});

// Connect to MongoDB
connectDB();

// Routes
app.use('/api', require('./routes'));

const io = require('socket.io')(httpServer, {
  cors: {
    origin: 'http://192.168.1.104:8080',
  },
});

const crypto = require('crypto');
const randomId = () => crypto.randomBytes(8).toString('hex');

const { InMemorySessionStore } = require('./sessionStore');
const sessionStore = new InMemorySessionStore();

const { InMemoryMessageStore } = require('./messageStore');
const messageStore = new InMemoryMessageStore();

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  // console.log(sessionID);
  if (sessionID) {
    const session = sessionStore.findSession(sessionID);
    if (session) {
      socket.sessionID = sessionID;
      socket.userID = session.userID;
      socket.username = session.username;
      return next();
    }
  }
  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error('invalid username'));
  }
  socket.sessionID = randomId();
  socket.userID = randomId();
  socket.username = username;
  next();
});

io.on('connection', (socket) => {
  console.log(
    '\x1b[32m%s\x1b[0m',
    'connected user: ' + socket.username + ', session: ' + socket.sessionID
  );
  // persist session
  sessionStore.saveSession(socket.sessionID, {
    userID: socket.userID,
    username: socket.username,
    connected: true,
  });

  // emit session details
  socket.emit('session', {
    sessionID: socket.sessionID,
    userID: socket.userID,
    username: socket.username, //TODO TAMBAHAN
  });

  // join the "userID" room
  socket.join(socket.userID);

  // fetch existing users
  let users = [];
  const messagesPerUser = new Map();
  messageStore.findMessagesForUser(socket.userID).forEach((message) => {
    const { from, to } = message;
    const otherUser = socket.userID === from ? to : from;
    if (messagesPerUser.has(otherUser)) {
      messagesPerUser.get(otherUser).push(message);
    } else {
      messagesPerUser.set(otherUser, [message]);
    }
  });
  sessionStore.findAllSessions().forEach((session) => {
    users.push({
      userID: session.userID,
      username: session.username,
      connected: session.connected,
      messages: messagesPerUser.get(session.userID) || [],
    });
  });
  checkActiveUsers(users);
  socket.emit('users', users);

  // notify existing users
  socket.broadcast.emit('user connected', {
    userID: socket.userID,
    username: socket.username,
    connected: true,
    messages: [],
  });

  // notify users upon disconnection
  socket.on('disconnect', async () => {
    const matchingSockets = await io.in(socket.userID).allSockets();
    const isDisconnected = matchingSockets.size === 0;
    if (isDisconnected) {
      // notify other users
      socket.broadcast.emit('user disconnected', socket.userID);
      // update the connection status of the session
      console.log(
        '\x1b[31m%s\x1b[0m',
        'disconnected user: ' +
          socket.username +
          ', session: ' +
          socket.sessionID
      );
      sessionStore.saveSession(socket.sessionID, {
        userID: socket.userID,
        username: socket.username,
        connected: false,
      });
      users = [];
      sessionStore.findAllSessions().forEach((session) => {
        users.push({
          userID: session.userID,
          username: session.username,
          connected: session.connected,
          messages: messagesPerUser.get(session.userID) || [],
        });
      });
      checkActiveUsers(users);
      socket.broadcast.emit('users', users);
    }
  });
});

function checkActiveUsers(Users) {
  Users.forEach((user) => {
    if (user.connected) {
      console.log(new Date() + ` ${user.username} active`);
    } else {
      console.log(new Date() + ` ${user.username} inactive`);
    }
  });
}

const SOCKET_PORT = process.env.PORT || 3000;
const PAGE_PORT = process.env.PORT || 4000;

app.listen(SOCKET_PORT, () =>
  console.log(`Server running on http://192.168.1.104:${SOCKET_PORT}`)
);
httpServer.listen(PAGE_PORT, () => {
  console.log(`Socket Server running on http://192.168.1.104:${PAGE_PORT}`);
});
