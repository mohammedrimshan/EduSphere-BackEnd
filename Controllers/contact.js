// const nodemailer = require('nodemailer');
// require('dotenv').config();


// const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com', 
//   port: 587,
//   secure: true, 
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD
//   },
// });

// const sendContactEmail = async (req, res) => {
//   try {
//     const { name, email, subject, message } = req.body;

//     // Input validation
//     if (!name || !email || !subject || !message) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide all required fields'
//       });
//     }

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide a valid email address'
//       });
//     }

//     // Sanitize inputs to prevent injection
//     const sanitizedName = name.replace(/[<>]/g, '');
//     const sanitizedMessage = message.replace(/[<>]/g, '');
//     const sanitizedSubject = subject.replace(/[<>]/g, '');

//     // Common headers to improve deliverability
//     const commonHeaders = {
//       'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
//       'X-Priority': '3',
//       'X-MSMail-Priority': 'Normal',
//       'Importance': 'Normal',
//       'X-Mailer': 'EduSphere Contact System'
//     };

//     // Configure notification email
//     const mailOptions = {
//       from: {
//         name: 'EduSphere Contact Form',
//         address: process.env.EMAIL_USER
//       },
//       to: 'edusphere69@gmail.com',
//       replyTo: email,
//       subject: `Contact Form: ${sanitizedSubject}`,
//       headers: commonHeaders,
//       html: `
//         <h2>New Contact Form Submission</h2>
//         <p><strong>Name:</strong> ${sanitizedName}</p>
//         <p><strong>Email:</strong> ${email}</p>
//         <p><strong>Subject:</strong> ${sanitizedSubject}</p>
//         <p><strong>Message:</strong></p>
//         <p>${sanitizedMessage}</p>
//       `,
//       text: `New Contact Form Submission\n\nName: ${sanitizedName}\nEmail: ${email}\nSubject: ${sanitizedSubject}\n\nMessage:\n${sanitizedMessage}` // Plain text version
//     };

//     // Configure auto-reply
//     const autoReplyOptions = {
//       from: {
//         name: 'EduSphere Team',
//         address: process.env.EMAIL_USER
//       },
//       to: email,
//       subject: 'Thank you for contacting EduSphere',
//       headers: commonHeaders,
//       html: `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Thank You for Reaching Out</title>
//     <style>
//         .emoji { font-family: Arial, sans-serif; }
//     </style>
// </head>
// <body style="font-family: Arial, sans-serif; line-height: 1.6; background-color: #f0f8f0; margin: 0; padding: 0;">
//     <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
//         <tr>
//             <td style="padding: 40px 30px; background-color: #4CAF50; text-align: center;">
//                 <h2 style="color: #ffffff; margin: 0;">Thank you for reaching out! 👋</h2>
//             </td>
//         </tr>
//         <tr>
//             <td style="padding: 30px;">
//                 <p style="color: #333333;">Dear ${sanitizedName},</p>
//                 <p style="color: #333333;">We have received your message and will get back to you within 24 hours.</p>
//                 <p style="color: #333333;">Here's a copy of your message:</p>
//                 <table width="100%" style="background-color: #f9f9f9; border-radius: 4px; padding: 15px; margin-top: 10px;">
//                     <tr>
//                         <td>
//                             <p style="color: #4CAF50; margin: 0;"><strong>Subject:</strong> ${sanitizedSubject}</p>
//                             <p style="color: #4CAF50; margin: 10px 0 5px;"><strong>Message:</strong></p>
//                             <p style="color: #333333; margin: 0;">${sanitizedMessage}</p>
//                         </td>
//                     </tr>
//                 </table>
//                 <p style="color: #333333; margin-top: 20px;">Best regards,</p>
//                 <p style="color: #4CAF50; font-weight: bold; margin: 0;">The EduSphere Team 📚</p>
//             </td>
//         </tr>
//         <tr>
//             <td style="padding: 20px; background-color: #4CAF50; text-align: center;">
//                 <p style="color: #ffffff; margin: 0;">Connect with us: edusphere69@gmail.com | +91 8606760567</p>
//             </td>
//         </tr>
//     </table>
// </body>
// </html>`,
//       text: `Thank you for contacting EduSphere!\n\nDear ${sanitizedName},\n\nWe have received your message and will get back to you within 24 hours.\n\nHere's a copy of your message:\n\nSubject: ${sanitizedSubject}\nMessage:\n${sanitizedMessage}\n\nBest regards,\nThe EduSphere Team` // Plain text version
//     };

//     // Verify SMTP connection before sending
//     await transporter.verify();

//     // Send both emails
//     await Promise.all([
//       transporter.sendMail(mailOptions),
//       transporter.sendMail(autoReplyOptions)
//     ]);

//     return res.status(200).json({
//       success: true,
//       message: 'Your message has been sent successfully!'
//     });

//   } catch (error) {
//     console.error('Error sending email:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to send message. Please try again later.'
//     });
//   }
// };

// module.exports = { sendContactEmail };