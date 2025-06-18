const nodemailer = require("nodemailer");
const modemailer = require("nodemailer");
const User = require("../models/userSchema");
const axios = require("axios");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { throwError } = require("../errorHandler");
// Get local IP address (alternative to manual configuration)
const { networkInterfaces } = require("os");
const nets = networkInterfaces();
class authentication {
  constructor() {}
  static async confirmEmailChange(req, res) {
    try {
      const { token } = req.query;

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Store confirmation in database/cache
      await confirmationMiddleware.storeConfirmation(token);

      res.status(200).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: green;">Email Change Confirmed!</h2>
                <p>Thank you for confirming your email change.</p>
                <p>You can now close this window.</p>
            </div>
        `);
    } catch (error) {
      res.status(400).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: red;">Confirmation Failed</h2>
                <p>This confirmation link has expired or is invalid.</p>
            </div>
        `);
    }
  }
  static createEmailChangeConfirmationPage(step, options = {}) {
    const steps = {
      first: {
        title: "Old Email Confirmed",
        message: `Thank you for confirming your old email (${options.oldEmail}).`,
        additionalInfo: `We've sent a confirmation request to your new email (${options.newEmail}). Please check your inbox and confirm within 30 seconds to complete the change.`,
        isSuccess: true,
      },
      second: {
        title: "Email Changed Successfully!",
        message: `Your email has been successfully updated to ${options.newEmail}.`,
        additionalInfo: "You can now return to the app.",
        isSuccess: true,
        redirectUrl: process.env.APP_DEEP_LINK || process.env.FRONTEND_URL,
        redirectText: "Open App",
      },
      expired: {
        title: "Confirmation Expired",
        message: "The confirmation link has expired.",
        additionalInfo: "Please initiate the email change process again.",
        isSuccess: false,
      },
    };

    const currentStep = steps[step] || steps.first;
    
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentStep.title}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      body {
        background-color: #f5f7fa;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
      }
      .confirmation-container {
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
      }
      .icon {
        font-size: 60px;
        margin-bottom: 20px;
        color: ${currentStep.isSuccess ? "#4CAF50" : "#F44336"};
      }
      h1 {
        color: #333;
        margin-bottom: 15px;
        font-size: 24px;
      }
      p {
        color: #666;
        margin-bottom: 15px;
        line-height: 1.6;
      }
      .email-highlight {
        font-weight: bold;
        color: #2c3e50;
      }
      .additional-info {
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        margin: 20px 0;
        font-size: 14px;
      }
      .btn {
        display: inline-block;
        background-color: ${currentStep.isSuccess ? "#4CAF50" : "#F44336"};
        color: white;
        text-decoration: none;
        padding: 12px 25px;
        border-radius: 5px;
        font-weight: 500;
        transition: background-color 0.3s;
        margin-top: 10px;
      }
      .btn:hover {
        background-color: ${currentStep.isSuccess ? "#3e8e41" : "#d32f2f"};
      }
      @media (max-width: 480px) {
        .confirmation-container {
          padding: 25px;
        }
      }
    </style>
  </head>
  <body>
    <div class="confirmation-container">
      <div class="icon">${currentStep.isSuccess ? "✓" : "✗"}</div>
      <h1>${currentStep.title}</h1>
      <p>${currentStep.message}</p>
      ${
        currentStep.additionalInfo
          ? `<div class="additional-info">${currentStep.additionalInfo}</div>`
          : ""
      }
      ${
        currentStep.redirectUrl
          ? `<a href="${currentStep.redirectUrl}" class="btn">${currentStep.redirectText}</a>`
          : ""
      }
    </div>
  </body>
  </html>
  `;
  }
  static createEmailChangeConfirmationHtml(token, emailType) {
    const { networkInterfaces } = require("os");

    function getWirelessIP() {
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (
            net.family === "IPv4" &&
            !net.internal &&
            name.includes("Wi-Fi")
          ) {
            return net.address;
          }
        }
      }
      return "localhost"; // Fallback
    }

    const WIRELESS_IP = getWirelessIP();
    console.log(emailType);
    const action =
      emailType === "old"
        ? "confirm your email change"
        : "verify your new email";
    const buttonColor = emailType === "old" ? "#FF5733" : "#33A1FF";

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #333;">Email Change Confirmation</h2>
            <p>Please click the button below to ${action}.</p>
            <p>This link will expire in 30 seconds.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://${WIRELESS_IP}:3000/api/users/${
      emailType == "old"
        ? "confirm-old-email-change"
        : "confirm-new-email-change"
    }?token=${token}" 
                   style="background-color: ${buttonColor}; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Confirm Email Change
                </a>
            </div>
            <p>If you didn't request this change, please ignore this email or contact support.</p>
        </div>
    `;
  }
  static async sendConfirmationEmail({ email, subject, html }) {
    try {
      console.log(email, "aaaaaaaaa");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.USER_NAME,
          pass: process.env.APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.USER_NAME,
        to: email,
        subject,
        html,
      });
      console.log(email);
    } catch (error) {
      throwError("Failed to send confirmation email", 500);
    }
  }

  static async validateToken(req) {
    if (!req.headers.authorization)
      throwError("No authorization header was sent", 400);
    if (!req.headers.authorization.split(" ")[1])
      throwError("No token was sent", 400);
    let token = req.headers.authorization.split(" ")[1];
    token = await jwt.verify(token, process.env.JWT_SECRET);
    return token;
  }
  static async checkIfCodeMatches(code, user) {
    const lastVerificationCode =
      user.verificationCodes[user.verificationCodes.length - 1];

    if (
      !lastVerificationCode ||
      !(await bcryptjs.compare(code.toString(), lastVerificationCode.code))
    ) {
      throwError("Invalid verification code", 404);
    }

    return "Verification code matched successfully";
  }
  static async checkCodeAge(code, user) {
    const timeGapSeconds =
      Date.now() -
      user.verificationCodes[user.verificationCodes.length - 1].createdAt;
    if (timeGapSeconds < 30000)
      throwError(
        "you have to type the code within 30 seconds from recieving it.",
        400
      );
  }
  static async sendCode(email, code) {
    console.log(
      process.env.EMAIL,
      process.env.USER_NAME,
      process.env.APP_PASSWORD
    );
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USER_NAME,
        pass: process.env.APP_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Health Media Account Recovery",
      text: `your verification code is ${code}`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  }
  static async verifyPassword(password, hashedPassword) {
    console.log(password, hashedPassword);
    const res = await bcryptjs.compare(password, hashedPassword);
    res ? true : throwError("Password is wrong", 400);
  }
  static async createVerificationCode(user) {
    const code = Math.floor(Math.random() * 1000000).toString();

    const hashedCode = await bcryptjs.hash(code, 10);
    user.verificationCodes.push({ code: hashedCode });
    return code;
  }
  static async validateAccountData(data) {
    const requiredFields = [
      "userName",
      "firstName",
      "lastName",
      "birthDate",
      "email",
      "location",
      "preferredTopics",
    ];
    for (const field of requiredFields) {
      if (!data[field]) throwError("A missing field", 400);
    }
    const users = await User.find({ userName: data.userName });
    if (users.length) throwError("username is already taken");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) throwError("Invalid email-address ", 400);
    const birthDate = new Date(data.birthDate);
    const today = new Date();
    if (data.birthData > today) throwError("Birthdate is invalid", 400);

    if (!data.location.country || !data.location.city)
      throwError("Location info is not complete");
    if (Array.isArray(!data.preferredTopics))
      throwError("Invalid form of prefereed topics...should be an array", 400);
  }
  static async hashPassword(password) {
    try {
      const hashedPassword = await bcryptjs.hash(password, 10);
      return hashedPassword;
    } catch (error) {
      console.log(error.message);
      throwError("error while dealing with the password", 400);
    }
  }
  static async createToken(userId) {
    console.log(userId);
    if (!userId) throwError("no user id was provided ", 400);
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
    return token;
  }
}
module.exports = authentication;
