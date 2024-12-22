const User = require('../Models/UserModel');
const Tutor = require('../Models/TutorModel');
const { Chat } = require('../Models/ChatModel');

class OnlineStatusHandler {
  constructor(io) {
    this.io = io;
    this.onlineUsers = new Map();
    this.setupConnectionHandling();
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

  getUserKey(id, role = null) {
    if (!role) {
      const userKey = `user_${id}`;
      const tutorKey = `tutor_${id}`;
      return this.onlineUsers.has(userKey) ? userKey : tutorKey;
    }
    return role === 'tutor' ? `tutor_${id}` : `user_${id}`;
  }

  async handleUserOnline(socket, userData) {
    try {
      const { userId, role } = userData;
      if (!userId) {
        console.error('handleUserOnline: No userId provided');
        return;
      }

      const userKey = role === 'tutor' ? `tutor_${userId}` : `user_${userId}`;
      
      this.onlineUsers.set(userKey, { 
        socketId: socket.id, 
        role: role
      });

      socket.userId = userId;
      socket.userRole = role;

      const Model = role === 'tutor' ? Tutor : User;
      const updatedUser = await Model.findByIdAndUpdate(
        userId,
        { $set: { lastActive: new Date(), isOnline: true } },
        { new: true }
      );

      if (!updatedUser) {
        console.error(`No ${role} found with ID: ${userId}`);
        return;
      }

      const chats = await Chat.find(role === 'tutor' ? { tutor_id: userId } : { user_id: userId });

      for (const chat of chats) {
        const updateField = role === 'tutor'
          ? { tutor_is_online: true }
          : { student_is_online: true };

        const updatedChat = await Chat.findByIdAndUpdate(
          chat._id,
          { $set: updateField },
          { new: true }
        );

        if (!updatedChat) {
          console.error(`Failed to update chat: ${chat._id}`);
          continue;
        }

        socket.join(chat._id.toString());

        this.io.to(chat._id.toString()).emit('chat-status-update', {
          chatId: chat._id,
          student_is_online: role === 'student' ? true : updatedChat.student_is_online,
          tutor_is_online: role === 'tutor' ? true : updatedChat.tutor_is_online
        });
      }

      this.io.emit('user-status-change', {
        userId,
        isOnline: true,
        role: role
      });

      console.log(`${role} ${userId} is now online`);
    } catch (error) {
      console.error('Error in handleUserOnline:', error);
    }
  }

  async handleUserOffline(socket) {
    try {
      if (!socket.userId || !socket.userRole) {
        console.log('handleUserOffline: No user data in socket');
        return;
      }

      const userKey = this.getUserKey(socket.userId, socket.userRole);
      const userInfo = this.onlineUsers.get(userKey);

      if (!userInfo || userInfo.socketId !== socket.id) {
        console.log('handleUserOffline: No matching online user found');
        return;
      }

      const Model = socket.userRole === 'tutor' ? Tutor : User;
      const updatedUser = await Model.findByIdAndUpdate(
        socket.userId,
        { $set: { lastActive: new Date(), isOnline: false } },
        { new: true }
      );

      if (!updatedUser) {
        console.error(`No user found with ID: ${socket.userId}`);
        return;
      }

      const query = socket.userRole === 'student' 
        ? { user_id: socket.userId }
        : { tutor_id: socket.userId };
      
      const chats = await Chat.find(query);

      for (const chat of chats) {
        const updateField = socket.userRole === 'student'
          ? { student_is_online: false }
          : { tutor_is_online: false };

        const updatedChat = await Chat.findByIdAndUpdate(
          chat._id,
          { $set: updateField },
          { new: true }
        );

        if (!updatedChat) {
          console.error(`Failed to update chat: ${chat._id}`);
          continue;
        }

        this.io.to(chat._id.toString()).emit('chat-status-update', {
          chatId: chat._id,
          student_is_online: socket.userRole === 'student' ? false : updatedChat.student_is_online,
          tutor_is_online: socket.userRole === 'tutor' ? false : updatedChat.tutor_is_online
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
      console.error('Error in handleUserOffline:', error);
    }
  }

  setupConnectionHandling() {
    this.io.on('connection', (socket) => {
      console.log(`New socket connection: ${socket.id}`);

      socket.on('register-for-video', async (userData) => {
        await this.handleUserOnline(socket, userData);
      });

      socket.on('disconnect', async () => {
        await this.handleUserOffline(socket);
      });
    });
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

module.exports = OnlineStatusHandler;