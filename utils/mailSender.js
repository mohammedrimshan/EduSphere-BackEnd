const nodemailer = require("nodemailer");

const mailSender = async (email, subject, htmlContent) => {
  try {
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"EduSphere" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const otpEmailTemplate = (otp) => {
  return {
    subject: "Your EduSphere OTP Code 🔐",
    htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
            ">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="
                    background-color: #f5f5f5;
                    padding: 20px;
                ">
                    <tr>
                        <td align="center">
                            <table cellpadding="0" cellspacing="0" border="0" width="600" style="
                                background-color: #ffffff;
                                border-radius: 10px;
                                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                            ">
                                <!-- Header -->
                                <tr>
                                    <td align="center" style="padding: 40px 20px;">
                                        <h1 style="
                                            margin: 0;
                                            font-size: 28px;
                                            color: #333333;
                                        ">
                                            Welcome to <span style="color: #22c55e;">EduSphere</span> 🎓
                                        </h1>
                                    </td>
                                </tr>

                                <!-- OTP Section -->
                                <tr>
                                    <td align="center" style="padding: 20px;">
                                        <table cellpadding="0" cellspacing="0" border="0" style="
                                            background-color: #f8f9fa;
                                            border: 2px dashed #22c55e;
                                            border-radius: 8px;
                                            padding: 20px;
                                            width: 80%;
                                        ">
                                            <tr>
                                                <td align="center">
                                                    <p style="
                                                        font-size: 16px;
                                                        color: #4b5563;
                                                        margin: 0 0 15px 0;
                                                    ">
                                                        Your Verification Code 🔑
                                                    </p>
                                                    <div style="
                                                        font-size: 32px;
                                                        font-weight: bold;
                                                        color: #22c55e;
                                                        letter-spacing: 8px;
                                                        background-color: #ffffff;
                                                        padding: 15px 25px;
                                                        border-radius: 5px;
                                                        border: 1px solid #e5e7eb;
                                                    ">
                                                        ${otp}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Instructions -->
                                <tr>
                                    <td align="center" style="padding: 20px;">
                                        <p style="
                                            color: #4b5563;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            margin: 0 0 10px 0;
                                        ">
                                            ⏰ This code will expire in <strong>2 minutes</strong>
                                        </p>
                                        <p style="
                                            color: #4b5563;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            margin: 0 0 10px 0;
                                        ">
                                            🔒 For security reasons, please don't share this code
                                        </p>
                                        <p style="
                                            color: #4b5563;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            margin: 0;
                                        ">
                                            ✨ Use this code to complete your registration
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td align="center" style="
                                        padding: 30px 20px;
                                        background-color: #f8f9fa;
                                        border-bottom-left-radius: 10px;
                                        border-bottom-right-radius: 10px;
                                    ">
                                        <p style="
                                            color: #6b7280;
                                            font-size: 12px;
                                            margin: 0 0 10px 0;
                                        ">
                                            Need help? 💡 Contact our support team
                                        </p>
                                        <p style="
                                            color: #9ca3af;
                                            font-size: 12px;
                                            margin: 0;
                                        ">
                                            © 2024 <span style="color: #22c55e;">EduSphere</span>. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
  };
};

const passwordResetOtpTemplate = (resetLink) => {
  return {
    subject: "Reset Your Password 🔒",
    htmlContent: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
            ">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="
                    background-color: #f5f5f5;
                    padding: 20px;
                ">
                    <tr>
                        <td align="center">
                            <table cellpadding="0" cellspacing="0" border="0" width="600" style="
                                background-color: #ffffff;
                                border-radius: 10px;
                                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                            ">
                                <!-- Header -->
                                <tr>
                                    <td align="center" style="padding: 40px 20px;">
                                        <h1 style="
                                            margin: 0;
                                            font-size: 28px;
                                            color: #333333;
                                        ">
                                            Password Reset Request 🔄
                                        </h1>
                                    </td>
                                </tr>

                                <!-- Reset Password Section -->
                                <tr>
                                    <td align="center" style="padding: 20px;">
                                        <p style="
                                            font-size: 16px;
                                            color: #4b5563;
                                            margin: 0 0 15px 0;
                                        ">
                                            Click the button below to reset your password:
                                        </p>
                                        <a href="${resetLink}" style="
                                            background-color: #22c55e;
                                            color: #ffffff;
                                            padding: 15px 30px;
                                            text-decoration: none;
                                            border-radius: 5px;
                                            display: inline-block;
                                            margin-top: 20px;
                                            font-weight: bold;
                                        ">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>

                                <!-- Instructions -->
                                <tr>
                                    <td align="center" style="padding: 20px;">
                                        <p style="
                                            color: #4b5563;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            margin: 0 0 10px 0;
                                        ">
                                            If you did not request this password reset, please ignore this email.
                                        </p>
                                        <p style="
                                            color: #4b5563;
                                            font-size: 14px;
                                            line-height: 1.6;
                                            margin: 0;
                                        ">
                                            This link will expire in <strong>15 minutes</strong>.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td align="center" style="
                                        padding: 30px 20px;
                                        background-color: #f8f9fa;
                                        border-bottom-left-radius: 10px;
                                        border-bottom-right-radius: 10px;
                                    ">
                                        <p style="
                                            color: #6b7280;
                                            font-size: 12px;
                                            margin: 0 0 10px 0;
                                        ">
                                            Need help? 💡 Contact our support team.
                                        </p>
                                        <p style="
                                            color: #9ca3af;
                                            font-size: 12px;
                                            margin: 0;
                                        ">
                                            © 2024 <span style="color: #22c55e;">EduSphere</span>. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
  };
};

module.exports = { mailSender, otpEmailTemplate, passwordResetOtpTemplate };
