const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    video: {
      type: String,
      required: true,
    },
    video_thumbnail: {
      type: String,
      required: true,
    },
    pdf_note: {
      type: String,
      required: false,
    },
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "courses",
      required: true,
    },
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Lesson = mongoose.model("lessons", lessonSchema);

module.exports = Lesson;
