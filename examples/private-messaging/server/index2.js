const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./db');
const User = require('./models/UserData');

let second = '';
let minute = '';
let hour = '';
let date = '';
let month = '';
let year = '';
let outputWkt = '';

const app = express();
app.use(bodyParser.json());
const httpServer = require('http').createServer(app);

// Connect to MongoDB
connectDB();

const io = require('socket.io')(httpServer, {
  cors: {
    origin: 'http://192.168.1.104:8080',
  },
});

let cacheData = '';
let iterasiAntrian = 0;
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
  let cacheUsers = [];
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
  socket.emit('users', users);

  // notify existing users
  socket.broadcast.emit('user connected', {
    userID: socket.userID,
    username: socket.username,
    connected: true,
    messages: [],
  });

  function checkActiveUsers() {
    users = [];
    sessionStore.findAllSessions().forEach((session) => {
      if (session.connected) {
        users.push({
          userID: session.userID,
          username: session.username,
          connected: session.connected,
          messages: messagesPerUser.get(session.userID) || [],
        });
      }
    });

    // console.log(
    //   new Date() + ' | checkActiveUsers'
    // );
    if (cacheUsers.length > 0) {
      let totalDifferent = [];
      users.forEach((user) => {
        let different = '';
        cacheUsers.forEach((cacheUser) => {
          if (user.username === cacheUser.username) {
            if (user.userID !== cacheUser.userID) {
              different = 'yes';
            }
          }
        });
        if (different === 'yes') {
          totalDifferent.push(different);
        }
      });

      if (totalDifferent.length > 0) {
        console.log('checkActiveUsers | active user: ' + users.length);
        users.forEach(function (user) {
          console.log('user: ' + user.username);
        });
      }
    } else {
      console.log('checkActiveUsers | active user: ' + users.length);
      users.forEach(function (user) {
        console.log('user: ' + user.username);
      });
    }
    // users.forEach((user) => {
    //   let different = '';
    //   if (cacheUsers.length > 0) {
    //     cacheUsers.forEach((cacheUser) => {
    //       if (user.username === cacheUser.username) {
    //         if (user.userID !== cacheUser.userID) {
    //           different = 'yes';
    //         }
    //       }
    //     });
    //     if (different === 'yes') {
    //       console.log(
    //         new Date() + ' | checkActiveUsers | active user: ' + users.length
    //       );
    //       users.forEach(function (user) {
    //         console.log('user: ' + user.username);
    //       });
    //     }
    //   } else {
    //     console.log(
    //       new Date() + ' | checkActiveUsers | active user: ' + users.length
    //     );
    //     users.forEach(function (user) {
    //       console.log('user: ' + user.username);
    //     });
    //   }
    // });

    cacheUsers = [];
    sessionStore.findAllSessions().forEach((session) => {
      if (session.connected) {
        cacheUsers.push({
          userID: session.userID,
          username: session.username,
          connected: session.connected,
          messages: messagesPerUser.get(session.userID) || [],
        });
      }
    });

    antrianCheckTvApp(users);
  }

  function antrianCheckTvApp(antrianUser) {
    let giliranUserID = '';
    let giliranUsername = '';
    // let yangGiliranMaju = '';

    // if (iterasiAntrian < antrianUser.length) {
    //   yangGiliranMaju = iterasiAntrian;
    // } else {
    //   iterasiAntrian = 0;
    //   yangGiliranMaju = iterasiAntrian;
    // }

    // if (iterasiAntrian < antrianUser.length) {
    giliranUserID = antrianUser[iterasiAntrian].userID;
    giliranUsername = antrianUser[iterasiAntrian].username;

    getDataByUsername(giliranUsername).then((data) => {
      if (data) {
        // console.log('getDataByUsername: ' + data);
        cacheData = data.lastResponse;
        checkTvApp(giliranUsername, giliranUserID);
      } else {
        checkTvApp(giliranUsername, giliranUserID);
      }
    });
    // checkTvApp(giliranUsername, giliranUserID);
    // }
    //  else {
    //   iterasiAntrian = 0;
    // }
  }

  async function checkTvApp(kodetv, idsocket) {
    wktNow();
    let tvAppURL = 'http://dl.dmmxcorp.com/tvapp';
    const params = new URLSearchParams();
    params.append('DUID', kodetv);
    params.append('CHECKDATA', '1');
    params.append('GETDATA', '0');
    params.append('APPVER', '20240601');

    const response = await fetch(tvAppURL, {
      method: 'post',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (response.ok) {
      const data = await response.text();

      if (response.status === 200) {
        const splitData = data.split('~');
        const filetxt = splitData[0];
        console.log('antrian: ' + iterasiAntrian);
        console.log(
          `${outputWkt} | checkTvApp | ${filetxt} | ${response.status} | ${kodetv}`
        );
        if (cacheData !== data) {
          cacheData = data;

          const msg = {
            code: 200,
            status: 'Ada Distribusi Terbaru',
            update: 1,
          };

          saveOrUpdateUser({
            username: kodetv,
            userID: idsocket,
            response: data,
          }); //TODO Kalau mau dikasih then.
          // getDataByUsername(kodetv, idsocket);

          console.log('Ada Distribusi Baru | emit to ' + idsocket);
          socket.to(idsocket).emit('update:content', msg);
        }
        mengiterasiAntrian(iterasiAntrian, users);
      } else {
        console.log(
          `${outputWkt} + | checkTvApp | Failed | ${response.status} | ${kodetv}`
        );

        const msg = {
          code: 500,
          status: 'Socket Server Internal Error',
          update: 0,
        };

        console.log('Tidak Ada Distribusi Baru | emit to ' + idsocket);
        socket.to(idsocket).emit('update:content', msg);

        mengiterasiAntrian(iterasiAntrian, users);
      }
    }
  }

  function mengiterasiAntrian(iterasi, siUser) {
    iterasi = iterasi + 1;
    if (iterasi < siUser.length) {
      iterasiAntrian = iterasi;
    } else {
      iterasiAntrian = 0;
    }
  }

  function wktNow() {
    second = ('0' + new Date().getSeconds()).slice(-2);
    minute = ('0' + new Date().getMinutes()).slice(-2);
    hour = ('0' + new Date().getHours()).slice(-2);
    date = ('0' + new Date().getDate()).slice(-2);
    month = ('0' + (new Date().getMonth() + 1)).slice(-2);
    year = new Date().getFullYear();
    outputWkt =
      year +
      '-' +
      month +
      '-' +
      date +
      ' ' +
      hour +
      ':' +
      minute +
      ':' +
      second;
  }

  setInterval(function () {
    checkActiveUsers();
  }, 60000);

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
      socket.broadcast.emit('users', users);
    }
  });
});

const saveOrUpdateUser = async ({ username, userID, response }) => {
  let resultSplit = '';
  const UserData = require('./models/UserData');
  try {
    const result = await UserData.findOneAndUpdate(
      { username }, // Search by unique username
      { userID, lastResponse: response }, // Update userID and response
      { upsert: true, new: true } // Create a new record if not found
    );

    resultSplit = result.lastResponse.split('~');
    fileTxtResult = resultSplit[0];

    console.log(
      `checkTvApp | ${fileTxtResult} | ${username} | User data saved/updated`
    );
    return result;
  } catch (error) {
    console.error(
      `checkTvApp | ${fileTxtResult} | ${username} | Error saving/updating user data: `,
      error
    );
    return null;
  }
};

const getDataByUsername = async (username) => {
  const UserData = require('./models/UserData');
  try {
    const data = await UserData.findOne({ username });
    return data;
  } catch (error) {
    console.error('Error fetching data by username:', error);
    return null;
  }
};

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () =>
  console.log(`Server running on http://192.168.1.104:${PORT}`)
);
