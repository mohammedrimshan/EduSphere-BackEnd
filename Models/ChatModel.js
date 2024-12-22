// models/Chat.js
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  user_id: {
    type: String,
    ref: 'User',
    required: true
  },
  tutor_id: {
    type: String,
    ref: 'Tutor',
    required: true
  },
  last_message: {
    sender_id: {
      type: String,
      default: null
    },
    message_text: {
      type: String,
      default: null
    },
    time_stamp: {
      type: Date,
      default: null
    }
  },
  unread_message_count: {
    student: {
      type: Number,
      default: 0
    },
    tutor: {
      type: Number,
      default: 0
    }
  },
  student_is_online: {
    type: Boolean,
    default: false
  },
  tutor_is_online: {
    type: Boolean,
    default: false
  },
  is_blocked: {
    status: {
      type: Boolean,
      default: false
    },
    blocked_by: {
      type: String,
      default: null
    },
    reason: { 
      type: String, 
      default: "" 
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

const Chat = mongoose.model('Chat', chatSchema);

// models/Message.js
const messageSchema = new mongoose.Schema(
  {
    chat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true
    },
    message_id: {
      type: String,
      required: true
    },
    sender_id: {
      type: String,
      required: true
    }, 
    receiver_id: {
      type: String,
      required: true
    },
    message_text: {
      type: String,
      required: true
    },
    is_read: {
      type: Boolean,
      default: false
    },
    time_stamp: {
      type: Date,
      default: Date.now
    },
    file_url: {
      type: String,
    },
    file_type: {
      type: String,
    },
    file_name: {
      type: String,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = { Chat, Message };

