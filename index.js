require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyparser = require("body-parser");
const socketHandler = require("./socketHandler");

const userRouter = require("./routes/userRoutes");
const postRouter = require("./routes/postRoutes");
const commentRouter = require("./routes/commentRoutes");
const chatRouter = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "*", // or process.env.Browser_URL if you want
    methods: ["GET", "POST"],
  },
});

// Pass io to socketHandler ONCElet ioInstance;

socketHandler(io);

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.Broswer_URL,
    allowedHeaders: ["Content-Type", "code", "Authorization", "postId"],
    exposedHeaders: ["Authorization", "code", "postId"],
    credentials: true,
  })
);

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to database");
  })
  .catch((err) => console.log(err.message));

app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/chats", chatRouter);
app.use("/api/comments", commentRouter);

app.use(express.static(path.join(__dirname, "./dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html")); // fixed typo from imdex.html
});

server.listen(process.env.SERVER_PORT || 3000, () => {
  console.log(`Server is running on port: ${process.env.SERVER_PORT || 3000}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
app.set("io", io);

// Export io instance so you can import it elsewhere and call its functions
module.exports = io;
