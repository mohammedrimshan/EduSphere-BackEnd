const { Course } = require('../Models/CourseModel'); // Adjust path as needed

class CourseRecommendationEngine {
  // Find related courses based on various criteria
  async findRelatedCourses(query, options = {}) {
    const {
      limit = 5,
      excludeCourseId = null,
      matchType = 'partial'
    } = options;

    try {
      // Build dynamic search conditions
      const searchConditions = this.buildSearchConditions(query, matchType);

      // Add additional filtering
      const baseFilter = {
        isActive: true,
        isBanned: false,
        ...searchConditions
      };

      // Exclude specific course if provided
      if (excludeCourseId) {
        baseFilter._id = { $ne: excludeCourseId };
      }

      // Fetch courses with additional details
      const relatedCourses = await Course.find(baseFilter)
        .populate('category', 'name')
        .populate('tutor', 'full_name')
        .sort({ 
          enrolled_count: -1,  // Prioritize popular courses
          average_rating: -1   // Then by highest rated
        })
        .limit(limit)
        .lean(); // Use lean for better performance

      return relatedCourses.map(this.formatCourseForRecommendation);
    } catch (error) {
      console.error('Recommendation Engine Error:', error);
      return [];
    }
  }

  // Build search conditions dynamically
  buildSearchConditions(query, matchType = 'partial') {
    const normalizedQuery = query.toLowerCase().trim();

    // Multiple search strategies
    const searchConditions = {
      $or: [
        // Title matching
        { title: matchType === 'partial' 
          ? { $regex: normalizedQuery, $options: 'i' }
          : normalizedQuery 
        },
        // Description matching
        { description: matchType === 'partial' 
          ? { $regex: normalizedQuery, $options: 'i' }
          : normalizedQuery 
        },
        // Category matching (if query might be a category)
        { 'category.name': matchType === 'partial' 
          ? { $regex: normalizedQuery, $options: 'i' }
          : normalizedQuery 
        }
      ]
    };

    return searchConditions;
  }

  // Format course for recommendation response
  formatCourseForRecommendation(course) {
    return {
      id: course._id,
      title: course.title,
      description: course.description,
      category: course.category?.name || 'Uncategorized',
      level: course.level,
      price: course.price,
      offerPercentage: course.offer_percentage,
      enrolledCount: course.enrolled_count,
      averageRating: course.average_rating,
      tutor: course.tutor?.full_name || 'Unknown Instructor',
      thumbnail: course.course_thumbnail
    };
  }

  // Generate recommendation text
  async generateRecommendationResponse(query, options = {}) {
    const relatedCourses = await this.findRelatedCourses(query, options);
  
    if (relatedCourses.length === 0) {
      return null;
    }
  
    const recommendationText = relatedCourses.map((course, index) => 
      `${index + 1}. ${course.title} 
     - Level: ${course.level}
     - Category: ${course.category}
     - Rating: ${course.averageRating}/5 ⭐
     - Enrolled: ${course.enrolledCount} students
     - Price: ${course.price > 0 
       ? `$${course.price} (${course.offerPercentage}% off)` 
       : 'Free'}
     - Instructor: ${course.tutor}
     - Learn More: https://edusphere-ebon.vercel.app//user/courseview/${course.id}`
    ).join('\n\n');
  
    return `🚀 Related Courses Recommendation:\n\n${recommendationText}
  
  Would you like more details about any of these courses? 📚`;
  }
  
  // Recommend courses by specific methods
  async recommendByCategory(categoryId, options = {}) {
    try {
      const courses = await Course.find({
        category: categoryId,
        isActive: true,
        isBanned: false
      })
      .sort({ enrolled_count: -1, average_rating: -1 })
      .limit(options.limit || 5)
      .lean();

      return courses.map(this.formatCourseForRecommendation);
    } catch (error) {
      console.error('Category Recommendation Error:', error);
      return [];
    }
  }

  // Recommend popular courses
  async recommendPopularCourses(options = {}) {
    try {
      const courses = await Course.find({
        isActive: true,
        isBanned: false
      })
      .sort({ 
        enrolled_count: -1,
        average_rating: -1 
      })
      .limit(options.limit || 5)
      .lean();

      return courses.map(this.formatCourseForRecommendation);
    } catch (error) {
      console.error('Popular Courses Recommendation Error:', error);
      return [];
    }
  }
}

module.exports = CourseRecommendationEngine;