// Load environment variables at the top
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const fileUpload = require('express-fileupload');
const connectDB = require("./Config/db");

// Import routes
const authRoutes = require("./Routes/authRoute");
const studentRoutes = require("./Routes/userRoute");
const tutorRoutes = require("./Routes/tutorRoute");
const adminRoutes = require("./Routes/adminRoute");
const { socketHandler } = require("./utils/socketHandler");
const OnlineStatusHandler = require("./utils/onlineStatusHandler");

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

// Increase max listeners for EventEmitter
require('events').EventEmitter.defaultMaxListeners = 20;

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "https://edusphere.rimshan.in",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Set max listeners for socket.io
io.setMaxListeners(20);

const onlineStatusHandler = new OnlineStatusHandler(io);

// Apply socket handling
socketHandler(io);

io.on("connection", (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  // Emit socket ID for WebRTC
  socket.emit('me', socket.id);

  // Online status handling
  socket.on("user-online", (userData) => {
    onlineStatusHandler.handleUserOnline(socket, userData);
  });

  // Room joining
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`[${new Date().toISOString()}] Client ${socket.id} joined room: ${roomId}`);
  });

  // Messaging
  socket.on("send-message", (data) => {
    console.log(`[${new Date().toISOString()}] Received message:`, data);
    
    if (!data.chat_id) {
      console.error('No chat_id provided');
      return;
    }
  
    try {
      console.log(`Attempting to broadcast to room: ${data.chat_id}`);
      io.to(data.chat_id).emit("receive-message", data);
      console.log(`[${new Date().toISOString()}] Message successfully broadcasted to room: ${data.chat_id}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error broadcasting message:`, error);
    }
  });

  // Typing indicators
  socket.on("tutor-typing", (data) => {
    if (!data || !data.chat_id) {
      console.error('Invalid tutor-typing event: Missing chat_id', data);
      return;
    }
    console.log(`[${new Date().toISOString()}] Tutor typing in room: ${data.chat_id}`);
    io.to(data.chat_id).emit("tutor-typing");
  });

  socket.on("tutor-stop-typing", (data) => {
    if (!data || !data.chat_id) {
      console.error('Invalid tutor-stop-typing event: Missing chat_id', data);
      return;
    }
    console.log(`[${new Date().toISOString()}] Tutor stopped typing in room: ${data.chat_id}`);
    io.to(data.chat_id).emit("tutor-stop-typing");
  });

  // Delete message handling
  socket.on("delete-message", (data) => {
    if (!data || !data.chat_id || !data.message_id) {
      console.error('Invalid delete-message event: Missing chat_id or message_id', data);
      return;
    }
    console.log(`[${new Date().toISOString()}] Deleting message in room: ${data.chat_id}, message ID: ${data.message_id}`);
    io.to(data.chat_id).emit("message-deleted", {
      chat_id: data.chat_id,
      message_id: data.message_id
    });
  });

  // WebRTC call handling
  //socket.on('callUser', ({ userToCall, signalData, from, name }) => {
    //io.to(userToCall).emit('callUser', { signal: signalData, from, name });
  //});

  //socket.on('answerCall', (data) => {
    //io.to(data.to).emit('callAccepted', data.signal);
  //});

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}`);
    onlineStatusHandler.handleUserOffline(socket);
    socket.broadcast.emit('callEnded');
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Socket error for client ${socket.id}:`, error);
  });
});
app.set("io", io)
// Middleware and configuration
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(fileUpload());

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "https://edusphere.rimshan.in",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Security and caching headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline';"
  );
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/user", studentRoutes);
app.use("/tutor", tutorRoutes);
app.use("/admin", adminRoutes);

// Root route
app.get("/", (req, res) => {
  res.status(200).send("Welcome to the EduSphere Platform API");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`EduSphere server is running on http://localhost:${PORT}`);
  console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Not Set");
  console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not Set");
  console.log("MONGO_URI:", process.env.MONGO_URI ? "Set" : "Not Set");
});
