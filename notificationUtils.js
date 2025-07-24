const onlineUsers = require("./onlineUsers");
const User=require('./models/userSchema')
// const io=require('./index')
 const sendNotification = ({io,
  type,
  actorUser,
  targetUserId,
  extraText = "",
  entity = {}
}) => {
  const name = actorUser.userName;
  const texts = {
    follow: `${name} started following you`,
    like_post: `${name} liked your post`,
    like_comment: `${name} liked your comment`,
    comment_post: `${name} commented on your post`,
    reply_comment: `${name} replied to your comment`,
  };

  const notification = {
    actorId: actorUser._id,
    userName: actorUser.userName,
    profileImage: actorUser.profileImage,
    text: texts[type] + extraText,
    date: new Date(),
    ...entity,
  };

  const sid = onlineUsers.getSocketId(targetUserId.toString());
  console.log(onlineUsers.getAll())
  if (sid && io) {
    console.log(io)
    io.to(sid).emit("new_notification", notification);
    console.log('asd')
}
};


const isUserOnline = async (userId) => {
  const isOnline = onlineUsers.isOnline(userId.toString());
  console.log(onlineUsers.getAll())
  return isOnline
};

  
  module.exports={sendNotification,isUserOnline}