const express=require('express')
const userMiddleware=require('../middleware/userMiddleware')
const {profileImageUploader}=require('../multerUploaders')
const userController=require('../controllers/userController')
const router=express.Router()
router.post('/create-account',userController.createAccount)
router.get('/login',userController.login)
router.get('/validate-token',userController.validateToken)
router.get('/request-code',userController.createVerificationCode)
router.get('/verify-code',userController.verifyCode)
router.post('/profile-image',userMiddleware.profileSetupMiddleware,profileImageUploader.single('file'),userController.setProfileImage)
router.get('/profile-image',userController.sendProfileImage)

module.exports=router