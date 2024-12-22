const Quiz = require("../Models/QuizModel");
const { Course } = require("../Models/CourseModel");
const Certificate = require("../Models/CertificateModel");
const User = require("../Models/UserModel");
const Tutor = require("../Models/TutorModel");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Add quiz to a course
const addQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Questions array is required and must not be empty",
      });
    }

    for (const question of questions) {
      if (
        !question.questionText ||
        !question.options ||
        !question.correctAnswer
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each question must have questionText, options, and correctAnswer",
        });
      }

      if (!question.options.includes(question.correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: "Correct answer must be one of the options",
        });
      }
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    let quiz = await Quiz.findOne({ courseId });

    if (quiz) {
      quiz.questions = questions;
      await quiz.save();
    } else {
      quiz = new Quiz({
        courseId,
        questions,
      });
      await quiz.save();

      course.quiz = quiz._id;
      await course.save();
    }

    res.status(201).json({
      success: true,
      message: quiz ? "Quiz updated successfully" : "Quiz created successfully",
      data: quiz,
    });
  } catch (error) {
    console.error("Error in addQuiz:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update quiz",
      error: error.message,
    });
  }
};

// Get quiz by course ID
const getQuizByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const quiz = await Quiz.findOne({ courseId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "No quiz found for this course",
      });
    }

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Error in getQuizByCourse:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quiz",
      error: error.message,
    });
  }
};

// Update quiz
const updateQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Questions array is required and must not be empty",
      });
    }

    for (const question of questions) {
      if (
        !question.questionText ||
        !question.options ||
        !question.correctAnswer
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each question must have questionText, options, and correctAnswer",
        });
      }

      if (!question.options.includes(question.correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: "Correct answer must be one of the options",
        });
      }
    }

    const quiz = await Quiz.findOne({ courseId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    quiz.questions = questions;
    await quiz.save();

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: quiz,
    });
  } catch (error) {
    console.error("Error in updateQuiz:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quiz",
      error: error.message,
    });
  }
};

// Delete quiz
const deleteQuizQuestion = async (req, res) => {
  try {
    const { courseId, questionId } = req.params;

    const quiz = await Quiz.findOne({ courseId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    quiz.questions = quiz.questions.filter(
      (question) => question._id.toString() !== questionId
    );

    await quiz.save();

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
      data: quiz,
    });
  } catch (error) {
    console.error("Error in deleteQuizQuestion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete quiz question",
      error: error.message,
    });
  }
};

// Issue a certificate
const issueCertificate = async (req, res) => {
  try {
    const { userId, tutorId, courseId, quizScorePercentage } = req.body;

    const missingFields = [];

    if (!userId) missingFields.push("userId");
    if (!tutorId) missingFields.push("tutorId");
    if (!courseId) missingFields.push("courseId");
    if (quizScorePercentage == null) missingFields.push("quizScorePercentage");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields: missingFields,
      });
    }

    if (quizScorePercentage < 0 || quizScorePercentage > 100) {
      return res.status(400).json({
        success: false,
        message: "Quiz score percentage must be between 0 and 100.",
      });
    }
    const user = await User.findById(userId);
    const tutor = await Tutor.findById(tutorId);
    const course = await Course.findById(courseId);

    const notFoundEntities = [];
    if (!user) notFoundEntities.push("User");
    if (!tutor) notFoundEntities.push("Tutor");
    if (!course) notFoundEntities.push("Course");

    if (notFoundEntities.length > 0) {
      return res.status(404).json({
        success: false,
        message: `${notFoundEntities.join(", ")} not found.`,
        notFoundEntities: notFoundEntities,
      });
    }

    const existingCertificate = await Certificate.findOne({ userId, courseId });
    if (existingCertificate) {
      return res.status(400).json({
        success: false,
        message: "Certificate for this course already exists.",
      });
    }

    const newCertificate = new Certificate({
      userId,
      tutorId,
      courseId,
      userName: user.full_name,
      tutorName: tutor.full_name,
      courseName: course.title,
      quizScorePercentage,
    });

    await newCertificate.save();

    res.status(201).json({
      success: true,
      message: "Certificate issued successfully.",
      certificate: newCertificate,
    });
  } catch (error) {
    console.error("Error issuing certificate:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get certificates for a user
const getUserCertificates = async (req, res) => {
  try {
    const { userId } = req.params;

    const certificates = await Certificate.find({ userId })
      .populate("courseId", "coursetitle")
      .populate("tutorId", "name")
      .sort({ issuedDate: -1 });

    if (!certificates || certificates.length === 0) {
      return res
        .status(404)
        .json({ message: "No certificates found for this user." });
    }

    res.status(200).json({ certificates });
  } catch (error) {
    console.error("Error fetching user certificates:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get certificate details
const getCertificateDetails = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findById(certificateId)
      .populate("userId", "name email")
      .populate("tutorId", "name")
      .populate("courseId", "coursetitle");

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found." });
    }

    res.status(200).json({ certificate });
  } catch (error) {
    console.error("Error fetching certificate details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  addQuiz,
  getQuizByCourse,
  updateQuiz,
  deleteQuizQuestion,
  issueCertificate,
  getUserCertificates,
  getCertificateDetails,
};
