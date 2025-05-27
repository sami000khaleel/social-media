const nodemailer = require("nodemailer");
const modemailer = require("nodemailer");
const User = require("../models/userSchema");
const axios = require("axios");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { throwError } = require("../errorHandler");
class authentication {
  constructor() {}
  static async validateToken(req) {
    if(!req.headers.authorization)
      throwError('No authorization header was sent',400)
    if(!req.headers.authorization.split(' ')[1])
      throwError('No token was sent',400)
    let token=req.headers.authorization.split(' ')[1]
    token =  await jwt.verify(token, process.env.JWT_SECRET);
  return token
  }
  static async checkIfCodeMatches(code, user) {
      const lastVerificationCode = user.verificationCodes[user.verificationCodes.length - 1];
  
      if (!lastVerificationCode || !(await bcryptjs.compare(code.toString(),lastVerificationCode.code))) {
        throwError( "Invalid verification code",404 )
        
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
