// utils/onlineStatusHandler.js
const { Chat } = require('../Models/ChatModel');
const User = require('../Models/UserModel');

class OnlineStatusHandler {
  constructor(io) {
    this.io = io;
    this.onlineUsers = new Map();
    this.setupConnectionHandling();
  }

  setupConnectionHandling() {
    this.io.on('connection', (socket) => {
      console.log('New socket connection:', socket.id);

      socket.on('user-online', async (userData) => {
        await this.handleUserOnline(socket, userData);
      });

      socket.on('tutor-online', async (tutorData) => {
        await this.handleTutorOnline(socket, tutorData);
      });

      socket.on('request-user-status', async ({ userId }) => {
        await this.sendUserStatus(userId);
      });

      socket.on('disconnect', async () => {
        await this.handleUserOffline(socket);
      });
    });
  }

  getUserKey(id, role = null) {
    if (!role) {
      const userKey = `user_${id}`;
      const tutorKey = `tutor_${id}`;
      return this.onlineUsers.has(userKey) ? userKey : tutorKey;
    }
    return role === 'tutor' ? `tutor_${id}` : `user_${id}`;
  }

  findOnlineUser(userId) {
    const userKey = `user_${userId}`;
    const tutorKey = `tutor_${userId}`;
    
    if (this.onlineUsers.has(userKey)) {
      return {
        ...this.onlineUsers.get(userKey),
        userId,
        key: userKey
      };
    }
    
    if (this.onlineUsers.has(tutorKey)) {
      return {
        ...this.onlineUsers.get(tutorKey),
        userId,
        key: tutorKey
      };
    }
    
    return null;
  }

  async handleUserOnline(socket, userData) {
    try {
      const { userId } = userData;
      const userKey = `user_${userId}`;
      
      console.log(`User coming online: ${userId}`);
      
      this.onlineUsers.set(userKey, { 
        socketId: socket.id, 
        role: 'student'
      });

      socket.userId = userId;
      socket.userRole = 'student';

      await User.findByIdAndUpdate(userId, { isOnline: true });

      const chats = await Chat.find({ user_id: userId }).lean();

      for (const chat of chats) {
        await Chat.findByIdAndUpdate(chat._id, { student_is_online: true });
        socket.join(chat._id.toString());

        this.io.to(chat._id.toString()).emit('chat-status-update', {
          chatId: chat._id,
          student_is_online: true,
          tutor_is_online: chat.tutor_is_online || false
        });
      }

      this.io.emit('user-status-change', {
        userId,
        isOnline: true,
        role: 'student'
      });

      console.log(`User ${userId} is now online with socket ${socket.id}`);
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }

  async handleTutorOnline(socket, tutorData) {
    try {
      const { tutorId } = tutorData;
      const tutorKey = `tutor_${tutorId}`;
      
      console.log(`Tutor coming online: ${tutorId}`);
      
      this.onlineUsers.set(tutorKey, { 
        socketId: socket.id, 
        role: 'tutor'
      });

      socket.userId = tutorId;
      socket.userRole = 'tutor';

      await User.findByIdAndUpdate(tutorId, { isOnline: true });

      const chats = await Chat.find({ tutor_id: tutorId }).lean();

      for (const chat of chats) {
        await Chat.findByIdAndUpdate(chat._id, { tutor_is_online: true });
        socket.join(chat._id.toString());

        this.io.to(chat._id.toString()).emit('chat-status-update', {
          chatId: chat._id,
          student_is_online: chat.student_is_online || false,
          tutor_is_online: true
        });
      }

      this.io.emit('user-status-change', {
        userId: tutorId,
        isOnline: true,
        role: 'tutor'
      });

      console.log(`Tutor ${tutorId} is now online with socket ${socket.id}`);
    } catch (error) {
      console.error('Error setting tutor online:', error);
    }
  }

  async handleUserOffline(socket) {
    try {
      if (!socket.userId || !socket.userRole) {
        console.log('Disconnected socket had no user data:', socket.id);
        return;
      }

      const userKey = this.getUserKey(socket.userId, socket.userRole);
      const userInfo = this.onlineUsers.get(userKey);

      if (!userInfo || userInfo.socketId !== socket.id) {
        console.log('Socket did not match stored socket for user:', userKey);
        return;
      }

      console.log(`Handling offline status for ${userKey}`);

      await User.findByIdAndUpdate(socket.userId, { isOnline: false });

      const query = socket.userRole === 'student' 
        ? { user_id: socket.userId }
        : { tutor_id: socket.userId };
      
      const chats = await Chat.find(query).lean();

      for (const chat of chats) {
        const updateField = socket.userRole === 'student'
          ? { student_is_online: false }
          : { tutor_is_online: false };

        await Chat.findByIdAndUpdate(chat._id, updateField);

        this.io.to(chat._id.toString()).emit('chat-status-update', {
          chatId: chat._id,
          student_is_online: socket.userRole === 'student' ? false : (chat.student_is_online || false),
          tutor_is_online: socket.userRole === 'tutor' ? false : (chat.tutor_is_online || false)
        });
      }

      this.io.emit('user-status-change', {
        userId: socket.userId,
        isOnline: false,
        role: socket.userRole
      });

      this.onlineUsers.delete(userKey);
      console.log(`${socket.userRole} ${socket.userId} is now offline`);
    } catch (error) {
      console.error('Error handling user offline:', error);
    }
  }

  isUserOnline(id, role) {
    return this.onlineUsers.has(this.getUserKey(id, role));
  }

  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  getOnlineTutors() {
    const tutors = {};
    for (const [key, value] of this.onlineUsers.entries()) {
      if (key.startsWith("tutor_")) {
        tutors[key.split("_")[1]] = value;
      }
    }
    return tutors;
  }
  
  getOnlineStudents() {
    const students = {};
    for (const [key, value] of this.onlineUsers.entries()) {
      if (key.startsWith("user_")) {
        students[key.split("_")[1]] = value;
      }
    }
    return students;
  }
}

// utils/videoHandler.js
class VideoHandler {
  constructor(io, onlineStatusHandler) {
    this.io = io;
    this.onlineStatusHandler = onlineStatusHandler;
    this.activeConnections = new Map();
    this.pendingOffers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Video socket connected:', socket.id);

      socket.on('register-for-video', (data) => {
        try {
          const { userId, role } = data;
          console.log(`Registering for video - UserId: ${userId}, Role: ${role}, SocketId: ${socket.id}`);
          
          socket.userId = userId;
          socket.userRole = role;
          
          const userKey = role === 'tutor' ? `tutor_${userId}` : `user_${userId}`;
          this.onlineStatusHandler.onlineUsers.set(userKey, {
            socketId: socket.id,
            role: role
          });
          
          socket.emit('video-registration-success', { userId, role });
          console.log(`Video registration successful - UserKey: ${userKey}`);
        } catch (error) {
          console.error('Video registration error:', error);
          socket.emit('video-registration-error', { message: error.message });
        }
      });

      socket.on("initiateCall", async (data) => {
        try {
          console.log('Call initiation request:', data);
          const { signalData, receiver_id, callerInfo } = data;
          
          if (!signalData || !receiver_id) {
            throw new Error('Missing call data');
          }

          if (!socket.userId) {
            throw new Error('Caller not registered');
          }

          const receiverInfo = this.onlineStatusHandler.findOnlineUser(receiver_id);
          console.log('Found receiver:', receiverInfo);
          
          if (!receiverInfo || !receiverInfo.socketId) {
            throw new Error('Receiver not found or offline');
          }

          // Store the offer for this call
          this.pendingOffers.set(receiver_id, {
            from: socket.userId,
            signalData,
            callerInfo
          });

          console.log(`Sending call to socket: ${receiverInfo.socketId}`);
          this.io.to(receiverInfo.socketId).emit("incomingCall", {
            fromUserId: socket.userI,
            signalData,
            callerInfo
          });

          console.log('Call signal sent');
        } catch (error) {
          console.error('Call initiation error:', error);
          socket.emit('callError', { message: error.message });
        }
      });

      socket.on("answerCall", (data) => {
        try {
          console.log('Call answer:', data);
          const { signalData, toUserId } = data;
          
          if (!signalData || !toUserId) {
            console.error('Missing answer data:', { signalData, toUserId });
            return;
          }
      
          const callerInfo = this.onlineStatusHandler.findOnlineUser(toUserId);
          console.log('Found caller:', callerInfo);
      
          if (!callerInfo || !callerInfo.socketId) {
            throw new Error('Caller not found');
          }

          // Get the original offer
          const originalOffer = this.pendingOffers.get(socket.userId);
          if (!originalOffer) {
            throw new Error('No pending offer found');
          }
      
          console.log(`Sending answer to socket: ${callerInfo.socketId}`);
          this.io.to(callerInfo.socketId).emit("callAccepted", {
            signalData,
            from: socket.userId,
            originalOffer: originalOffer.signalData // Include the original offer
          });

          // Clear the pending offer
          this.pendingOffers.delete(socket.userId);
        } catch (error) {
          console.error('Call answer error:', error);
          socket.emit('callError', { message: error.message });
        }
      });

      socket.on("iceCandidate", ({ candidate, receiverId }) => {
        try {
          const receiverInfo = this.onlineStatusHandler.findOnlineUser(receiverId);
          if (receiverInfo && receiverInfo.socketId) {
            this.io.to(receiverInfo.socketId).emit("iceCandidate", {
              candidate,
              from: socket.userId
            });
          }
        } catch (error) {
          console.error('ICE candidate error:', error);
        }
      });

      socket.on("endCall", ({ receiverId }) => {
        try {
          const receiverInfo = this.onlineStatusHandler.findOnlineUser(receiverId);
          if (receiverInfo && receiverInfo.socketId) {
            this.io.to(receiverInfo.socketId).emit("callEnded");
            // Clean up any pending offers
            this.pendingOffers.delete(receiverId);
          }
        } catch (error) {
          console.error('End call error:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('Video socket disconnected:', socket.id);
        if (socket.userId) {
          // Clean up any pending offers for this user
          this.pendingOffers.delete(socket.userId);
          
          const userKey = socket.userRole === 'tutor' 
            ? `tutor_${socket.userId}` 
            : `user_${socket.userId}`;
          console.log(`Removing from video registry: ${userKey}`);
          const userInfo = this.onlineStatusHandler.onlineUsers.get(userKey);
          if (userInfo && userInfo.socketId === socket.id) {
            this.onlineStatusHandler.onlineUsers.delete(userKey);
          }
        }
      });
    });
  }
}

module.exports = { OnlineStatusHandler, VideoHandler };