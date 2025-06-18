const path = require("path");
const fs = require("fs");
const Post = require("../models/postSchema");
const Comment=require('../models/commentSchema')
const { throwError } = require("../errorHandler");
class commentMiddleware {
  constructor() {}
  static async findCommentById(commentId) {
    console.log(commentId)
    if (!commentId) throwError("no comment id was sent", 404);
    const comment = await Comment.findById(commentId);
    if (!comment?.id) throwError("no error was found", 404);
    return comment
  }
}
module.exports = commentMiddleware;
