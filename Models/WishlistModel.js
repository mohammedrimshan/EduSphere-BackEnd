const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: true
  }]
}, { 
  timestamps: true 
});

// Prevent duplicate courses in wishlist
wishlistSchema.index({ user: 1, courses: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);