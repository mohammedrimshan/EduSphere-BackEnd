const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'courses',
      },
    ],
    tutors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, 
  }
);


CategorySchema.index({ title: 1 }); 
CategorySchema.index({ isVisible: 1 }); 
CategorySchema.index({ createdAt: -1 }); 


const Category = mongoose.model('categories', CategorySchema);

module.exports = Category;
