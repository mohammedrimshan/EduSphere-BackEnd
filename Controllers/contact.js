const nodemailer = require('nodemailer');
require('dotenv').config();

// Validate environment variables
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// Create reusable transporter with better error handling
const createTransporter = async () => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      // Add timeout to prevent hanging
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    // Verify connection
    await transporter.verify();
    console.log('Email transporter ready');
    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw new Error('Email service configuration failed');
  }
};

const sendContactEmail = async (req, res) => {
  let transporter;
  try {
    transporter = await createTransporter();
    
    const { name, email, subject, message } = req.body;

    // Enhanced input validation
    const validationErrors = [];
    if (!name?.trim()) validationErrors.push('Name is required');
    if (!email?.trim()) validationErrors.push('Email is required');
    if (!subject?.trim()) validationErrors.push('Subject is required');
    if (!message?.trim()) validationErrors.push('Message is required');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) validationErrors.push('Invalid email format');

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Enhanced sanitization
    const sanitize = (str) => {
      return str
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 1000); // Reasonable length limit
    };

    const sanitizedData = {
      name: sanitize(name),
      message: sanitize(message),
      subject: sanitize(subject)
    };

    // Common email configuration
    const commonConfig = {
      from: {
        name: 'EduSphere Contact Form',
        address: process.env.EMAIL_USER
      },
      headers: {
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
        'X-Priority': '3',
        'Importance': 'Normal',
        'X-Mailer': 'EduSphere Contact System'
      }
    };

    // Send emails with proper error handling
    await Promise.all([
      transporter.sendMail({
        ...commonConfig,
        to: 'edusphere69@gmail.com',
        replyTo: email,
        subject: `Contact Form: ${sanitizedData.subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${sanitizedData.name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${sanitizedData.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${sanitizedData.message}</p>
        `,
        text: `New Contact Form Submission\n\nName: ${sanitizedData.name}\nEmail: ${email}\nSubject: ${sanitizedData.subject}\n\nMessage:\n${sanitizedData.message}`
      }),
      transporter.sendMail({
        ...commonConfig,
        to: email,
        subject: 'Thank you for contacting EduSphere',
        html: `<!DOCTYPE html>
        <html lang="en">
          <!-- Auto-reply HTML template remains the same -->
        </html>`,
        text: `Thank you for contacting EduSphere!\n\nDear ${sanitizedData.name},\n\nWe have received your message and will get back to you within 24 hours.`
      })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully!'
    });

  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Provide more specific error messages
    const errorMessage = error.code === 'EAUTH' 
      ? 'Email authentication failed'
      : 'Failed to send message. Please try again later.';
    
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  } finally {
    // Clean up transporter
    if (transporter) {
      transporter.close();
    }
  }
};

module.exports = { sendContactEmail };