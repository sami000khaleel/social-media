
const multer =require('multer')
const path=require('path')
const { throwError } = require('./errorHandler')
const profileImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `uploads/profiles/${req.user.id}`) // Directory must exist
    },
    filename: (req, file, cb) => {

      const uniqueName = `${req.user.id+path.extname(file.originalname)}`
      cb(null, uniqueName)
    }
  })
  
  const profileImageUploader = multer({
    storage: profileImageStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1 // Only 1 file
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/
      const mimetype = allowedTypes.test(file.mimetype)
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
      
      if (mimetype && extname) {
        return cb(null, true)
      }
      throwError('Only images (JPEG, JPG, PNG, GIF, WEBP) are allowed!',400)
    }
  })
  module.exports={profileImageUploader}