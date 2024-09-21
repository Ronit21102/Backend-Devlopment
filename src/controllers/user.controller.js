import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {User} from "../models/users.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;
  
  console.log(req.body);
  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existed = await User.findOne({
    $or: [{ email }, { userName }],
  });

  if (existed) {
    throw new ApiError(409, "User already exist");
  }

  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is required");
  }
  console.log(avatarLocalPath, coverImageLocalPath);
  const avatarUrl = await uploadOnCloudinary(avatarLocalPath);
  console.log(avatarUrl);
  const coverImageUrl = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatarUrl) {
    throw new ApiError(400, "Avatar upload failed");
  }

  const user = await User.create({
    fullName,
    avatar: avatarUrl.url,
    coverImage: coverImageUrl.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  })
  

   const cretedUser = await user.findById(user._id).select("-password -refreshToken");

   if(!createdUser){
    throw new ApiError(500,"internal server error");
   }

   return res.json(new ApiResponse(200,"User created successfully",createdUser));
});

