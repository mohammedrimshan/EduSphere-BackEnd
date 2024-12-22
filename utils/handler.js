const { Chat } = require("../Models/ChatModel");
const { videoChatHandlers } = require("./videoChatHandlers");
const OnlineStatusHandler = require("./onlineStatusHandler");

let onlineTutors = {};
let onlineStudents = {};

const socketHandler = (io) => {
  const connectedClients = new Set();
  const onlineStatusHandler = new OnlineStatusHandler(io); // Initialize OnlineStatusHandler

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Extract user role and ID from query params
    const { role, user_id } = socket.handshake.query;

    if (!role || !user_id) {
      console.warn("Connection missing role or user_id");
      socket.disconnect(true);
      return;
    }

    // Track online users
    if (role === "tutor") {
      onlineTutors[user_id] = { socketId: socket.id, user_id };
      onlineStatusHandler.handleTutorOnline(socket, { tutorId: user_id });
    } else if (role === "student") {
      onlineStudents[user_id] = { socketId: socket.id, user_id };
      onlineStatusHandler.handleUserOnline(socket, { userId: user_id });
    }

    // Broadcast updated user list
    io.emit("users-update", {
      onlineTutors: Object.keys(onlineTutors),
      onlineStudents: Object.keys(onlineStudents),
    });

    // Integrate Video Chat Handlers
    videoChatHandlers(io, socket, onlineTutors, onlineStudents);

    // Message handler (example usage)
    socket.on("send-message", async (data) => {
      console.log(`Message received: ${data}`);
      const receiver = onlineTutors[data.receiver_id] || onlineStudents[data.receiver_id];
      if (receiver) {
        io.to(receiver.socketId).emit("receive-message", data);
      }
    });

    // Disconnect logic
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      if (role === "tutor") {
        delete onlineTutors[user_id];
        onlineStatusHandler.handleUserOffline(socket);
      } else if (role === "student") {
        delete onlineStudents[user_id];
        onlineStatusHandler.handleUserOffline(socket);
      }

      // Broadcast updated user list
      io.emit("users-update", {
        onlineTutors: Object.keys(onlineTutors),
        onlineStudents: Object.keys(onlineStudents),
      });
    });
  });
};

module.exports = { socketHandler };
