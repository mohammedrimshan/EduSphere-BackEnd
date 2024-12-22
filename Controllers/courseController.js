const mongoose = require("mongoose");
const { Course } = require("../Models/CourseModel");
const Category = require("../Models/CategoryModel");
const Tutor = require("../Models/TutorModel");
const Lesson = require("../Models/LessonModel");
const Quiz = require("../Models/QuizModel");
const admin = require("firebase-admin");
const User = require("../Models/UserModel");
const { mailSender } = require("../utils/mailSender");


//Add Courses 
const addCourse = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      price,
      offer_percentage,
      tutor,
      lessons,
      duration,
      quiz,
      course_thumbnail,
      level,
    } = req.body;

    console.log("Received data:", req.body);

    if (
      !title ||
      !category ||
      !description ||
      !price ||
      !tutor ||
      !course_thumbnail ||
      !level ||
      !duration
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    let categoryData;
    if (mongoose.Types.ObjectId.isValid(category)) {
      categoryData = await Category.findById(category);
    } else {
      categoryData = await Category.findOne({ title: category });
    }

    if (!categoryData) {
      return res.status(404).json({ message: "Category not found." });
    }

    const tutorExists = await Tutor.findById(tutor);
    if (!tutorExists) {
      return res.status(404).json({ message: "Tutor not found." });
    }

    if (lessons && lessons.length) {
      const validLessons = await Lesson.find({ _id: { $in: lessons } });
      if (validLessons.length !== lessons.length) {
        return res.status(400).json({ message: "Some lessons are invalid." });
      }
    }

    const newCourse = new Course({
      title,
      category: categoryData._id,
      description,
      price,
      offer_percentage: offer_percentage || 0,
      tutor,
      lessons,
      duration,
      quiz,
      course_thumbnail,
      level,
    });

    await newCourse.save();

    await Category.findByIdAndUpdate(categoryData._id, {
      $addToSet: { courses: newCourse._id },
    });

    await Tutor.findByIdAndUpdate(tutor, {
      $addToSet: { courses: newCourse._id },
    });

    res.status(201).json({
      message: "Course added successfully.",
      course: newCourse,
    });
  } catch (error) {
    console.error("Error in addCourse:", {
      message: error.message,
      stack: error.stack,
      data: req.body,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//Update Courses
const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      category,
      description,
      price,
      offer_percentage,
      level,
      duration,
      course_thumbnail,
      tutor,
    } = req.body;

    console.log("Updating course:", courseId);
    console.log("Received data:", req.body);

    if (
      !title ||
      !description ||
      !price ||
      !tutor ||
      !course_thumbnail ||
      !level ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided.",
      });
    }

    const existingCourse = await Course.findById(courseId);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    if (existingCourse.tutor.toString() !== tutor) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You don't have permission to update this course.",
      });
    }

    let categoryData;
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryData = await Category.findById(category);
      } else {
        categoryData = await Category.findOne({ title: category });
      }

      if (!categoryData) {
        return res.status(404).json({
          success: false,
          message: "Category not found.",
        });
      }
    } else {
      categoryData = await Category.findById(existingCourse.category);
    }

    const tutorExists = await Tutor.findById(tutor);
    if (!tutorExists) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found.",
      });
    }

    if (
      categoryData &&
      existingCourse.category.toString() !== categoryData._id.toString()
    ) {
      await Category.findByIdAndUpdate(existingCourse.category, {
        $pull: { courses: courseId },
      });

      await Category.findByIdAndUpdate(categoryData._id, {
        $addToSet: { courses: courseId },
      });
    }

    const offerChanged =
      existingCourse.offer_percentage !== parseInt(offer_percentage);

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        title,
        category: categoryData ? categoryData._id : existingCourse.category,
        description,
        price: parseFloat(price),
        offer_percentage: parseInt(offer_percentage) || 0,
        level,
        duration: parseInt(duration),
        course_thumbnail,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate("category", "title")
      .populate("tutor", "full_name email");

    if (offerChanged && existingCourse.listed) {
      try {
        const users = await User.find(
          { status: true },
          "fcmToken email full_name"
        );

        const discountedPrice =
          price - price * (parseInt(offer_percentage) / 100);

        const notificationData = {
          title: "Course Offer Updated! 🎉",
          body: `${title} now has a ${offer_percentage}% discount!`,
        };

        await User.updateMany(
          { status: true },
          {
            $push: {
              notifications: {
                ...notificationData,
                createdAt: new Date(),
                read: false,
              },
            },
          }
        );

        const notificationPromises = users.map(async (user) => {
          if (user.fcmToken) {
            const message = {
              notification: notificationData,
              data: {
                courseId: updatedCourse._id.toString(),
                type: "course_offer_updated",
              },
              token: user.fcmToken,
            };

            try {
              await admin.messaging().send(message);
            } catch (error) {
              console.error(
                `Failed to send push notification to user ${user._id}:`,
                error
              );
            }
          }

          if (user.email) {
            try {
              const emailBody = `
                Hello ${user.full_name},
                
                Great news! The course "${title}" from ${
                existingCourse.tutor.full_name
              } has a new offer!
                
                Original Price: ₹${price}
                New Discount: ${offer_percentage}%
                New Price: ₹${discountedPrice.toFixed(2)}
                
                Don't miss this amazing deal!
                
                Best regards,
                EduSphere Team
              `;

              await mailSender(user.email, "Course Offer Updated!", emailBody);
            } catch (error) {
              console.error(`Failed to send email to user ${user._id}:`, error);
            }
          }
        });

        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error(
          "Error sending offer update notifications:",
          notificationError
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("Error in updateCourse:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
      error: error.message,
    });
  }
};


//Get All Courses
const getCourses = async (req, res) => {
  try {
    const { tutorId } = req.query;

    let query = {};
    if (tutorId) {
      query.tutor = tutorId;
    } else {
      query.listed = true;
    }

    const courses = await Course.find(query)
      .sort({ createdAt: -1 })
      .populate("category", "title")
      .populate("tutor", "full_name email profile_image")
      .populate("lessons");

    res.status(200).json({
      success: true,
      courses: courses.map((course) => ({
        ...course.toObject(),
        isBlocked: course.isBlocked || false,
      })),
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching courses",
      error: error.message,
    });
  }
};


//GetCourse By ID
const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { tutorId } = req.query;

    console.log("Fetching course:", courseId, "Tutor:", tutorId);

    const course = await Course.findById(courseId)
      .populate("category", "title")
      .populate("tutor", "full_name email profile_image")
      .populate("lessons")
      .populate("quiz");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const isTutorAccess =
    tutorId && course.tutor._id.toString() === tutorId.toString();

    console.log("Is tutor access:", isTutorAccess);
    console.log("Course listed status:", course.listed);

    if (!course.listed && !isTutorAccess) {
      return res.status(404).json({
        success: false,
        message: "Course not found or unavailable",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course retrieved successfully",
      course: {
        ...course.toObject(),
        isBlocked: course.isBlocked || false,
      },
    });
  } catch (error) {
    console.error("Error in getCourseById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching course",
      error: error.message,
    });
  }
};


//Delete Courses
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    await Category.findByIdAndUpdate(course.category, {
      $pull: { courses: courseId },
    });

    await Course.findByIdAndDelete(courseId);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteCourse:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting course",
      error: error.message,
    });
  }
};

//Course Listing And Unlisting
const toggleCourseListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { listed } = req.body;

    const course = await Course.findById(id)
      .populate("tutor", "full_name")
      .populate("category", "title");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (listed && !course.listed) {
      try {
        const users = await User.find(
          { status: true },
          "fcmToken email full_name"
        );

        const discountedPrice =
          course.price - course.price * (course.offer_percentage / 100);

        const notificationData = {
          title: "New Course Available! 🎓",
          body: `${course.title} from ${
            course.tutor.full_name
          } is now available${
            course.offer_percentage > 0
              ? ` with ${course.offer_percentage}% off`
              : ""
          }!`,
        };

        await User.updateMany(
          { status: true },
          {
            $push: {
              notifications: {
                ...notificationData,
                createdAt: new Date(),
                read: false,
              },
            },
          }
        );

        const notificationPromises = users.map(async (user) => {
          if (user.fcmToken) {
            const message = {
              notification: notificationData,
              data: {
                courseId: course._id.toString(),
                type: "new_course_listed",
              },
              token: user.fcmToken,
            };

            try {
              await admin.messaging().send(message);
            } catch (error) {
              console.error(
                `Failed to send push notification to user ${user._id}:`,
                error
              );
            }
          }

          if (user.email) {
            try {
              const emailBody = `
                Hello ${user.full_name},
                
                Exciting news! A new course "${course.title}" from ${
                course.tutor.full_name
              } is now available in the ${course.category.title} category${
                course.offer_percentage > 0 ? ` with a special offer` : ""
              }!
                
                ${
                  course.offer_percentage > 0
                    ? `
                Original Price: ₹${course.price}
                Discount: ${course.offer_percentage}%
                New Price: ₹${discountedPrice.toFixed(2)}
                `
                    : ""
                }
                
                Don't miss out on this amazing learning opportunity!
                
                Best regards,
                EduSphere Team
              `;

              await mailSender(user.email, "New Course Available!", emailBody);
            } catch (error) {
              console.error(`Failed to send email to user ${user._id}:`, error);
            }
          }
        });

        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error("Error sending notifications:", notificationError);
      }
    }

    course.listed = listed;
    await course.save();

    res.status(200).json({
      success: true,
      message: "Course listing status updated successfully",
      data: {
        listed: course.listed,
      },
    });
  } catch (error) {
    console.error("Error in toggleCourseListing:", error);
    res.status(500).json({
      success: false,
      message: "Error updating course listing status",
      error: error.message,
    });
  }
};


//Add Lesson for Course
const addLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      duration,
      video,
      video_thumbnail,
      tutor,
      pdf_note,
    } = req.body;

    console.log("Received lesson data:", req.body);
    console.log("Received files:", req.files);

    if (
      !title ||
      !description ||
      !duration ||
      !video ||
      !video_thumbnail ||
      !tutor
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const newLesson = new Lesson({
      title,
      description,
      duration: Number(duration),
      video,
      video_thumbnail,
      pdf_note: pdf_note || null,
      course_id: courseId,
      tutor,
    });

    const savedLesson = await newLesson.save();

    course.lessons.push(savedLesson._id);
    await course.save();

    res.status(201).json({
      success: true,
      message: "Lesson added successfully",
      data: { lesson: savedLesson },
    });
  } catch (error) {
    console.error("Error in addLesson:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


//Get Lesson By Course
const getLessonsbyCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const lessons = await Lesson.find({ course_id: courseId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      message: "Lessons retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    console.error("Error in getLessons:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve lessons",
      error: error.message,
    });
  }
};


//Get All Lessons
const getLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .populate("course_id", "title")
      .populate("tutor", "full_name");

    res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Error in getLessons:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


//Get Each Lesson
const getLessonById = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate("course_id", "title")
      .populate("tutor", "full_name");

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error("Error in getLessonById:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


//Update Lesson
const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const existingLesson = await Lesson.findById(lessonId);
    if (!existingLesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    const { title, description, duration } = req.body;
    if (!title?.trim() || !description?.trim() || !duration) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and duration are required",
      });
    }

    if (!req.body.video && !existingLesson.video) {
      return res
        .status(400)
        .json({ success: false, message: "Video is required" });
    }
    if (!req.body.video_thumbnail && !existingLesson.video_thumbnail) {
      return res
        .status(400)
        .json({ success: false, message: "Thumbnail is required" });
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(
      lessonId,
      {
        ...req.body,
        title: title.trim(),
        description: description.trim(),
        duration: Number(duration),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: {
        lesson: updatedLesson,
      },
    });
  } catch (error) {
    console.error("Error in updateLesson:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update lesson",
      error: error.message,
    });
  }
};



//Delete Lesson 
const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    console.log("Delete request received for lessonId:", lessonId);

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    await Course.findByIdAndUpdate(lesson.course_id, {
      $pull: { lessons: lessonId },
    });

    await Lesson.findByIdAndDelete(lessonId);

    console.log(`Lesson with ID ${lessonId} deleted successfully`);

    res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteLesson:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete lesson",
      error: error.message,
    });
  }
};


//Submit Courses
const submitCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate("lessons");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!course.lessons || course.lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course must have at least one lesson before submission",
      });
    }

    course.status = "completed";
    course.publishedAt = new Date();
    await course.save();

    res.status(200).json({
      success: true,
      message: "Course submitted successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error in submitCourse:", error);

    res.status(500).json({
      success: false,
      message: "Failed to submit course",
      error: error.message,
    });
  }
};


//Get Course By Category
const getCourseByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    console.log("Requested categoryId:", categoryId);

    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      minPrice,
      maxPrice,
      rating,
    } = req.query;

    const category = await Category.findById(categoryId);
    console.log("Found category:", category);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    let query = {
      category: categoryId,
      listed: true,
    };

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (rating) {
      query.rating = { $gte: parseFloat(rating) };
    }

    console.log("Query object:", query);

    const sortOptions = {};
    sortOptions[sort] = order === "desc" ? -1 : 1;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const courses = await Course.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber)
      .populate("tutor", "full_name profile_image")
      .populate("category", "title");

    console.log("Found courses:", courses);

    const totalCourses = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      courses,
      totalCourses,
      totalPages: Math.ceil(totalCourses / limitNumber),
      currentPage: pageNumber,
    });
  } catch (error) {
    console.error("Error in getCourseByCategory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching courses by category",
      error: error.message,
    });
  }
};

module.exports = {
  addCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  addLesson,
  getLessons,
  getLessonById,
  updateLesson,
  deleteLesson,
  getLessonsbyCourse,
  submitCourse,
  toggleCourseListing,
  getCourseByCategory,
};
