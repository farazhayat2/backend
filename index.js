import express from 'express';
import { client } from './dbConfig.js';
import userRoutes from './Routes/userRoutes.js'
import authRoutes from './Routes/authRoutes.js'
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv'


dotenv.config();
client.connect();
console.log('you Successfully connect to mongodb');

const app = express()
const port = process.env.PORT || 3001
app.use(express.json());
app.use(cookieParser());

app.use(authRoutes)

app.use((req, res, next) => {
 try{
  let decoded = jwt.verify(req.cookies.token, process.env.SECREY_KEY);
  next()
 }catch(error){
  return res.send({
    status : 0,
    error : error,
    message : "Invalid Token"
  })
 }
})


app.use(userRoutes)


export default app

