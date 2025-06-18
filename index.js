require("dotenv").config();
const express = require("express");
const userRouter = require("./routes/userRoutes");
const postRouter = require("./routes/postRoutes");
const commentRouter = require("./routes/commentRoutes");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const fs = require("fs");
const cors = require("cors");
const app = express();
const bodyparser = require("body-parser");
const multer = require("multer");
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.use(bodyparser.json());
const { socket } = require("socket.io");
app.use(
  cors({
    origin: process.env.Broswer_URL, // Your frontend URL
    allowedHeaders: ["Content-Type", "code", "Authorization", "postId"],
    exposedHeaders: ["Authorization", "code", "postId"],
    credentials: true,
  })
);
app.use(bodyparser.urlencoded({ extended: true }));
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("connected to database");
  })
  .catch((err) => console.log(err.message));
// const socketHandler=require('./socketHandler')
// io.on('connection',(socket)=>{
//   socketHandler(socket)
// })

server.listen(process.env.SERVER_PORT ? process.env.SERVER_PORT : 3000, () => {
  console.log(`server is running on port : ${process.env.SERVER_PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Perform some error handling or logging here
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Perform some error handling or logging here
});
app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);
app.use(express.static(path.join(__dirname, "./dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "imdex.html"));
});
module.exports = { io };
