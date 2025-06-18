const multer = require("multer");
const path = require("path");
const { throwError } = require("./errorHandler");
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `uploads/profiles/${req.user.id}`); // Directory must exist
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.user.id + path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const usersImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `uploads/usersImages/${req.user.id}`); // Directory must exist
  },
  filename: (req, file, cb) => {
    const uniqueName = `${
      req.user.id + "__"+Math.random() + path.extname(file.originalname)
    }`;
    cb(null, uniqueName);
  },
});
const usersImagesUploader = multer({
  storage: usersImagesStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (for videos)
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const allowedVideoTypes = /mp4|mov|avi|mkv|webm/;

    const mimetype =
      allowedImageTypes.test(file.mimetype) ||
      allowedVideoTypes.test(file.mimetype);
    const extname =
      allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
      allowedVideoTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      // Apply different size limits based on file type
      const isVideo = allowedVideoTypes.test(file.mimetype);
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

      if (file.size > maxSize) {
        const type = isVideo ? "video" : "image";
        return cb(
          new Error(`${type} size exceeds ${maxSize / (1024 * 1024)}MB limit`),
          false
        );
      }

      return cb(null, true);
    }

    cb(
      new Error(
        "Only images (JPEG, JPG, PNG, GIF, WEBP) and videos (MP4, MOV, AVI, MKV, WEBM) are allowed!"
      ),
      false
    );
  },
});
const profileImageUploader = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only 1 file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    throwError("Only images (JPEG, JPG, PNG, GIF, WEBP) are allowed!", 400);
  },
});
const postMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `uploads/posts/${req.postId}`); // Directory must exist
  },
  filename: (req, file, cb) => {
    const uniqueName = `${
      `${req.postId}__` + Math.random() + path.extname(file.originalname)
    }`;

    cb(null, uniqueName);
  },
});

const postMediaUploader = multer({
  storage: postMediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (for videos)
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const allowedVideoTypes = /mp4|mov|avi|mkv|webm/;

    const mimetype =
      allowedImageTypes.test(file.mimetype) ||
      allowedVideoTypes.test(file.mimetype);
    const extname =
      allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
      allowedVideoTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      // Apply different size limits based on file type
      const isVideo = allowedVideoTypes.test(file.mimetype);
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

      if (file.size > maxSize) {
        const type = isVideo ? "video" : "image";
        return cb(
          new Error(`${type} size exceeds ${maxSize / (1024 * 1024)}MB limit`),
          false
        );
      }

      return cb(null, true);
    }

    cb(
      new Error(
        "Only images (JPEG, JPG, PNG, GIF, WEBP) and videos (MP4, MOV, AVI, MKV, WEBM) are allowed!"
      ),
      false
    );
  },
});
module.exports = {
  profileImageUploader,
  postMediaUploader,
  usersImagesUploader,
};
