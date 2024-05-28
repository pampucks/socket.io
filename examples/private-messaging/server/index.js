const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://192.168.1.110:8080",
  },
});

const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

const { InMemorySessionStore } = require("./sessionStore");
const sessionStore = new InMemorySessionStore();

const { InMemoryMessageStore } = require("./messageStore");
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
    return next(new Error("invalid username"));
  }
  socket.sessionID = randomId();
  socket.userID = randomId();
  socket.username = username;
  next();
});

io.on("connection", (socket) => {
  console.log(socket.userID);
  // persist session
  sessionStore.saveSession(socket.sessionID, {
    userID: socket.userID,
    username: socket.username,
    connected: true,
  });

  // emit session details
  socket.emit("session", {
    sessionID: socket.sessionID,
    userID: socket.userID,
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
  socket.emit("users", users);

  // notify existing users
  socket.broadcast.emit("user connected", {
    userID: socket.userID,
    username: socket.username,
    connected: true,
    messages: [],
  });

  // forward the private message to the right recipient (and to other tabs of the sender)
  socket.on("private message", ({ from, content, to }) => {
    const message = {
      content,
      // from: socket.userID,
      from,
      to,
    };
    if (message.to == "socketserver") {
      console.log("from: " + message.from + "\n" + "to: " + message.to + "\n" + "content: " + message.content + "\n")
    }
    // socket.to(to).to(socket.userID).emit("private message", message);
    // messageStore.saveMessage(message);
  });

  socket.on("update download", ({duid, zipname, wktdownload, to}) => {
    const message = {
      duid,
      zipname,
      wktdownload,
      to,
    }
    if (message.duid != "" && message.to != "" && message.zipname != "" && message.wktdownload != "") {
      const responseMsg = {
        statusMsg: "success",
        code: 200
      }
      if (message.to == "socketserver"){
        console.log("duid: " + message.duid + "\n" + "zipname: " + message.zipname + "\n" + "wktdownload: " + message.wktdownload + "\n")
        socket.emit("response", responseMsg)
      }
    }
  })

  socket.on("update content", ({message, to, from}) => {
    const requestContent = {
      message,
      to,
      from
    }
    const contentAMG = {
      sesiJadwal: "G4T6G34G4W",
      namaKonten: "s20240502154241.mp4",
      sizeKonten: "3137581",
      urutanKonten: 3
    }
    if (to == "socketserver") {
      console.log("message: " + requestContent.message + "\n" + "to: " + requestContent.to + "\n" + "from: " + requestContent.from + "\n")
      socket.emit("update content", contentAMG)
    }
  })

  // notify users upon disconnection
  socket.on("disconnect", async () => {
    const matchingSockets = await io.in(socket.userID).allSockets();
    const isDisconnected = matchingSockets.size === 0;
    if (isDisconnected) {
      // notify other users
      socket.broadcast.emit("user disconnected", socket.userID);
      // update the connection status of the session
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
      socket.broadcast.emit("users", users);
    }
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () =>
  console.log(`server listening at http://192.168.1.110:${PORT}`)
);
