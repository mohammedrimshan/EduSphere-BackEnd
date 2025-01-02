const { GoogleGenerativeAI } = require("@google/generative-ai");
const CourseRecommendationEngine = require('./recommedationHandler')
const genAI = new GoogleGenerativeAI("AIzaSyDlp14GByQ1vjQQeRLYB5nArU1dWqRAbXM");

const recommendationEngine = new CourseRecommendationEngine();

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "text/plain",
  },
});

async function generate(doubt, course_content, user_id) {
  const greetings = ["hi", "hello", "hey", "hii", "hola", "greetings"];
  if (greetings.includes(doubt.toLowerCase().trim())) {
    return "Welcome to EduSphere! How can I assist you with your learning journey today?";
  }


 // Check for course recommendation keywords
 const recommendationKeywords = [
  'other courses', 'different course', 'recommend', 
  'what else', 'alternatives', 'more courses', 
  'course suggestions', 'learn more'
];

// Detect recommendation request
const isRecommendationRequest = recommendationKeywords.some(keyword => 
  doubt.toLowerCase().includes(keyword)
);

// Generate course recommendations if requested
let courseRecommendation = null;
if (isRecommendationRequest) {
  courseRecommendation = await recommendationEngine.generateRecommendationResponse('all');
}

// If no general recommendation, try topic-specific
if (!courseRecommendation) {
  courseRecommendation = await recommendationEngine.generateRecommendationResponse('all', {
    limit: 5  // Limit to 5 recommendations
  });
}

// If still no recommendation, get popular courses
if (!courseRecommendation) {
  const popularCourses = await recommendationEngine.recommendPopularCourses();
  if (popularCourses.length > 0) {
    courseRecommendation = popularCourses.map((course, index) => 
      `${index + 1}. ${course.title}
 - Category: ${course.category}
 - Rating: ${course.averageRating}/5 ⭐
 - Learn More: https://edusphere-ebon.vercel.app/user/courseview/${course.id}`
    ).join('\n\n');
  }
}


  const prompt = `
---
System Prompt (Role & Objective):
You are an AI-powered virtual assistant integrated into an educational platform. Your primary goal is to assist students by answering questions or resolving doubts based on specific lessons or topics they are studying. Your responses should be accurate, concise, and tailored to the lesson's context, helping the student understand the subject clearly. Provide examples or break down concepts into simpler terms when necessary. If you are unsure of an answer, suggest additional resources or recommend consulting an instructor.

IMPORTANT: Provide your response as plain text only. No JSON, labels, or special formatting.

---
System Instructions:
- Provide responses specifically related to the lesson's content.
- If additional resources or explanations are required, suggest links or references (if provided in the database).
- Avoid lengthy responses; prioritize clarity over complexity.
- Stay professional and supportive to encourage learning.
- Response must be direct plain text with emojis.
- Give Cheer full response
- If any question who made you , Give Response "EduSphere Integrated Me".
- If anyone ask unleated courses question recommend with courseRecommendation. 


---
Query : 
  Student Query: ${doubt}
  course Description: ${course_content}
  user id: ${user_id}
  tone: supportive and educational,
  response Length: "short and precise"


Remember: Respond with with a brief, clear explanation  without any formatting or labels.`;

  try {
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Remove any JSON-like artifacts, quotes, or labels
    responseText = responseText
      .replace(/^["']/, "")
      .replace(/["']$/, "")
      .replace(/^(response|explanation|answer):\s*/i, "")
      .replace(/[{}[\]]/, "")
      .trim();

    return responseText || "Unable to generate a response.";
  } catch (error) {
    console.error("Error in generate function:", error);
    return "Sorry, I couldn't process your request.";
  }
}

const socketHandler = (io) => {
  const connectedClients = new Set();

  io.on("connection", (socket) => {
    if (connectedClients.has(socket.id)) {
      socket.disconnect(true);
      return;
    }

    connectedClients.add(socket.id);
    console.log(
      `User connected: ${socket.id}. Total connected: ${connectedClients.size}`
    );

    socket.on("message", async (msg) => {
      console.log(`Received message from ${socket.id}:`, msg);

      try {
        const ai_response = await generate(
          msg.doubt,
          msg.course_content,
          msg.user_id
        );
        socket.emit("response", ai_response);
      } catch (error) {
        console.error(
          `Error processing message for ${socket.id}:`,
          error.message
        );
        socket.emit(
          "response",
          "An error occurred while processing your request."
        );
      }
    });

    socket.on("disconnect", () => {
      connectedClients.delete(socket.id);
      console.log(
        `User disconnected: ${socket.id}. Remaining connections: ${connectedClients.size}`
      );
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  setInterval(() => {
    console.log(`Active connections: ${connectedClients.size}`);
  }, 60000);
};

module.exports = { socketHandler };
