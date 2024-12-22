const VideoProgress = require("../Models/ProgressModel");

const updateProgress = async (req, res) => {
  try {
    const { userId, courseId, lessonId, currentTime, duration, progress } =
      req.body;
    const updatedProgress = await VideoProgress.findOneAndUpdate(
      { userId, courseId, lessonId },
      {
        currentTime,
        duration,
        progress,
        completed: progress >= 95,
        lastUpdated: Date.now(),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );
    res.status(200).json(updatedProgress);
  } catch (error) {
    console.error("Error updating video progress:", error);
    res
      .status(500)
      .json({ message: "Error updating video progress", error: error.message });
  }
};

const getProgress = async (req, res) => {
  try {
    const { userId, courseId, lessonId } = req.params;
    const progress = await VideoProgress.findOne({
      userId,
      courseId,
      lessonId,
    });

    if (!progress) {
      return res.status(200).json({
        currentTime: 0,
        duration: 0,
        progress: 0,
        completed: false,
      });
    }

    res.status(200).json(progress);
  } catch (error) {
    console.error("Error fetching video progress:", error);
    res
      .status(500)
      .json({ message: "Error fetching video progress", error: error.message });
  }
};

const getCourseProgress = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const progress = await VideoProgress.find({ userId, courseId });
    res.status(200).json(progress);
  } catch (error) {
    console.error("Error fetching course progress:", error);
    res
      .status(500)
      .json({
        message: "Error fetching course progress",
        error: error.message,
      });
  }
};

module.exports = {
  updateProgress,
  getProgress,
  getCourseProgress,
};
