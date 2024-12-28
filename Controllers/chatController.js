const { Chat, Message } = require('../Models/ChatModel');
const User = require('../Models/UserModel');
const {Course} = require('../Models/CourseModel');
const Tutor = require('../Models/TutorModel');
const { v4: uuidv4 } = require('uuid');
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const { mailSender } = require("../utils/mailSender");
// Get chats by user ID
const getChatsByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { role, tutorId } = req.query;
    console.log('Received params:', { user_id, role, tutorId });

    const isUser = role === 'user';
    const lookupCollection = isUser ? 'tutors' : 'users';

    let matchCondition = {
      $or: [{ user_id: user_id }, { tutor_id: user_id }]
    };

    if (tutorId) {
      matchCondition = {
        $and: [
          { user_id: user_id },
          { tutor_id: tutorId }
        ]
      };
    }

    const chats = await Chat.aggregate([
      {
        $match: matchCondition
      },
      {
        $lookup: {
          from: lookupCollection,
          localField: isUser ? 'tutor_id' : 'user_id',
          foreignField: 'user_id',
          as: 'userDetails'
        }
      },
      {
        $project: {
          user_id: 1,
          tutor_id: 1,
          last_message: 1,
          user_is_online: 1,
          tutor_is_online: 1,
          is_blocked: 1,
          unread_message_count: 1,
          'userDetails.full_name': 1,
          'userDetails.avatar': 1
        }
      }
    ]);
    console.log('Found chats:', chats);
    res.status(200).json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get messages by chat ID
const getMessagesByChatId = async (req, res) => {
  try {
    const { chat_id } = req.params;
    console.log('Fetching messages for chat:', chat_id);

    const messages = await Message.find({ chat_id })
    .populate({
      path: 'reply_to',
      select: 'message_text sender_id time_stamp'
    })
    .sort({ createdAt: 1 });

    console.log('Found messages:', messages.length);
    console.log('Sample message:', messages[0]); 
    
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create a new chat
const createChat = async (req, res) => {
  try {
    const { newChatDetails, role } = req.body;
    const { user_id, tutor_id } = newChatDetails;
    console.log('Received params:', { user_id, role, tutor_id });

    const isUser = role === 'user';
    const lookupCollection = isUser ? 'tutors' : 'users';

    let chat = await Chat.findOne({ user_id, tutor_id });

    if (!chat) {
      chat = await Chat.create({ user_id, tutor_id });
    }

    const chatToSent = await Chat.aggregate([
      {
        $match: { _id: chat._id }
      },
      {
        $lookup: {
          from: lookupCollection,
          localField: isUser ? 'tutor_id' : 'user_id',
          foreignField: 'user_id',
          as: 'userDetails'
        }
      },
      {
        $project: {
          user_id: 1,
          tutor_id: 1,
          last_message: 1,
          user_is_online: 1,
          tutor_is_online: 1,
          is_blocked: 1,
          unread_message_count: 1,
          'userDetails.full_name': 1,
          'userDetails.avatar': 1
        }
      }
    ]);

    res.status(200).json(chatToSent[0] || {});
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a chat
const deleteChat = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const chat = await Chat.findByIdAndDelete(chat_id);
    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const createMessage = async (req, res) => {
  try {
    console.log('Received message request:', req.body);
    const { chat_id, sender_id, receiver_id, message, message_text, file_url, file_type, file_name } = req.body;

    // Use message if message_text is not provided
    // If no text message and a file is present, use a default file message
    const messageContent = message_text || message || (file_url ? 'Sent a file' : '');

    const newMessage = await Message.create({
      chat_id,
      message_id: uuidv4(),
      sender_id,
      receiver_id,
      message_text: messageContent,
      file_url,
      file_type,
      file_name
    });

    await Chat.findByIdAndUpdate(chat_id, {
      last_message: {
        sender_id,
        message_text: file_url ? 'Sent a file' : messageContent,
        time_stamp: new Date()
      },
      updated_at: new Date(),
      $inc: { 
        'unread_message_count.student': sender_id === receiver_id ? 1 : 0,
        'unread_message_count.tutor': sender_id !== receiver_id ? 1 : 0
      }
    });

    console.log('Created new message:', newMessage);

    const io = req.app.get('io');
    if (io) {
      try {
        io.to(chat_id.toString()).emit('receive-message', {
          chat: { _id: chat_id },
          message: newMessage
        });
        console.log(`Message emitted to room ${chat_id}`);
      } catch (socketError) {
        console.error('Socket emission error:', socketError);
      }
    } else {
      console.warn('Socket.io instance not available');
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: error.message });
  }
};


// Get users by tutor ID
const getUsersByTutorId = async (req, res) => {
  try {
    const { tutor_id } = req.params;
    console.log('Starting getUsersByTutorId with tutor_id:', tutor_id);

    const tutorObjectId = new mongoose.Types.ObjectId(tutor_id);

    const coursesCheck = await Course.find({ tutor: tutorObjectId });
    console.log('Found courses:', coursesCheck);

    if (!coursesCheck.length) {
      console.log('No courses found for tutor:', tutor_id);
      return res.status(200).json({ 
        users: [],
        unread_message_count: 0 
      });
    }

    const courseIds = coursesCheck.map(course => course._id);
    console.log('Course IDs:', courseIds);

    const users = await User.aggregate([
      {
        $match: {
          'courses.course': { $in: courseIds }
        }
      },
      {
        $project: {
          _id: 1,
          full_name: 1,
          profileImage: 1
        }
      }
    ]);


    const chats = await Chat.find({ tutor_id: tutor_id });
    const chatIds = chats.map(chat => chat._id);

    const unreadMessageCount = await Message.countDocuments({
      chat_id: { $in: chatIds },
      receiver_id: tutor_id,
      is_read: false
    });

    console.log('Found users:', users);
    console.log('Unread message count:', unreadMessageCount);

    return res.status(200).json({ 
      users: users,
      unread_message_count: unreadMessageCount
    });
  } catch (error) {
    console.error('Error in getUsersByTutorId:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};

// Get tutors by user ID
const getTutorsByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    console.log('Received params:', { user_id, role });

    const findTutors = await User.aggregate([
      {
        $match: { user_id: user_id }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'active_courses',
          foreignField: 'course_id',
          as: 'courses'
        }
      },
      {
        $unwind: '$courses'
      },
      {
        $lookup: {
          from: 'tutors',
          localField: 'courses.tutor_id',
          foreignField: '_id',
          as: 'tutors'
        }
      },
      {
        $unwind: '$tutors'
      },
      {
        $group: {
          _id: '$tutors.user_id',
          full_name: { $first: '$tutors.full_name' },
          avatar: { $first: '$tutors.avatar' },
          user_id: { $first: '$tutors.user_id' }
        }
      },
      {
        $project: {
          _id: 0,
          full_name: 1,
          avatar: 1,
          user_id: 1
        }
      }
    ]);

    res.status(200).json(findTutors);
  } catch (error) {
    console.error('Error fetching tutors by user ID:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Mark message as read
const markMessageAsRead = async (req, res) => {
  try {
    const { chat_id, user_role } = req.body;
    const chat = await Chat.findById(chat_id);
    const isUser = user_role === 'user';

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    isUser
      ? (chat.unread_message_count.user = 0)
      : (chat.unread_message_count.tutor = 0);

    await chat.save();

    res.status(200).json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { chat_id, message_id } = req.params;  // Changed from _id to message_id
    console.log('Attempting to delete message:', { chat_id, message_id });

    // Validate chat_id format
    if (!mongoose.Types.ObjectId.isValid(chat_id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid chat_id format'
      });
    }

    // Find the message using chat_id and UUID message_id
    const messageToDelete = await Message.findOne({
      chat_id: new mongoose.Types.ObjectId(chat_id),
      message_id: message_id  // Using UUID message_id here
    });

    if (!messageToDelete) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }

    // Delete the message
    await Message.deleteOne({ _id: messageToDelete._id });

    // Get the latest message for the chat
    const latestMessage = await Message.findOne({ 
      chat_id: new mongoose.Types.ObjectId(chat_id) 
    })
      .sort({ createdAt: -1 })
      .select('sender_id message_text createdAt')
      .lean();

    // Update chat's last message
    await Chat.findByIdAndUpdate(chat_id, {
      last_message: latestMessage ? {
        sender_id: latestMessage.sender_id,
        message_text: latestMessage.message_text,
        time_stamp: latestMessage.createdAt
      } : null,
      updated_at: new Date()
    });

    // After successfully deleting the message
    const io = req.app.get('io');
    if (io) {
      io.to(chat_id).emit("message-deleted", {
        chat_id,
        message_id,
        latest_message: latestMessage
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Message deleted successfully',
      data: {
        deleted_message: {
          message_id: messageToDelete.message_id,  // Return the UUID message_id
          _id: messageToDelete._id
        },
        latest_message: latestMessage
      }
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getChatsByUserId,
  getMessagesByChatId,
  createChat,
  deleteChat,
  createMessage,
  getUsersByTutorId,
  getTutorsByUserId,
  markMessageAsRead,
  deleteMessage
};

