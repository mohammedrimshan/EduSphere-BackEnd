const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: true,
  },
  questions: [
    {
      questionText: {
        type: String,
        required: true,
      },
      options: [
        {
          type: String,
          required: true,
        }
      ],
      correctAnswer: {
        type: String,
        required: true,
      },
    }
  ],
}, {
  timestamps: true,
});

const Quiz = mongoose.model('quizes', QuizSchema);
module.exports = Quiz;