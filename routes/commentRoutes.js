const express=require('express')
const router=express.Router()
const commentController=require('../controllers/commentController')
router.post('/create-comment',commentController.createComment)
router.get('/get-replies',commentController.getReplies)
router.put('/like-comment',commentController.likeComment)
router.delete('/delete-comment',commentController.deleteComment)
module.exports=router