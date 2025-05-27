function handleError(err,res) { 
    console.error(err)
    if (err?.userError) 
        // Client error
        return  res.status(err?.status || 400).json({ message: err.message,success:false });
    // Server error
    return  res.status(500).json({ message: 'Internal Server Error',success:false });
  }
  function throwError(message,status){
    let err = new Error(message);
    err.userError = true;
    err.status = status;
    throw err; // This exits the function
  }
module.exports={handleError,throwError}
